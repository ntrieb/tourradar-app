import express from 'express';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
// Allow embedding in iframes
app.use((req, res, next) => { res.removeHeader('X-Frame-Options'); next(); });
app.use(express.static(join(__dirname, 'public')));

const MCP_URL = 'https://ai.tourradar.com/mcp/main';

async function createClient() {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  const client = new Client({ name: 'europe-tours-app', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  return client;
}

// Discover available tools
app.get('/api/tools', async (req, res) => {
  try {
    const client = await createClient();
    const { tools } = await client.listTools();
    await client.close();
    res.json(tools);
  } catch (err) {
    console.error('Tools error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Search Europe tours
app.get('/api/tours', async (req, res) => {
  const { q = 'Europe', destination = 'Europe', style } = req.query;
  try {
    const client = await createClient();
    const { tools } = await client.listTools();
    console.log('Available tools:', tools.map(t => t.name));

    // Find a search tool
    const searchTool =
      tools.find(t => t.name === 'search_tours') ||
      tools.find(t => t.name.toLowerCase().includes('search')) ||
      tools.find(t => t.name.toLowerCase().includes('tour')) ||
      tools[0];

    if (!searchTool) {
      await client.close();
      return res.status(404).json({ error: 'No search tool found', tools: tools.map(t => t.name) });
    }

    console.log('Using tool:', searchTool.name, 'Schema:', JSON.stringify(searchTool.inputSchema, null, 2));

    // Build args based on the tool's input schema properties
    const schema = searchTool.inputSchema?.properties || {};
    const args = {};
    for (const [key, def] of Object.entries(schema)) {
      const lk = key.toLowerCase();
      if (lk.includes('destination') || lk.includes('location') || lk.includes('region') || lk.includes('country')) {
        args[key] = destination;
      } else if (lk.includes('query') || lk.includes('search') || lk.includes('text') || lk.includes('keyword')) {
        args[key] = q;
      } else if (lk.includes('style') && style) {
        args[key] = style;
      }
    }
    // If no args mapped, try common defaults
    if (Object.keys(args).length === 0) {
      args.destination = destination;
      args.query = q;
    }

    console.log('Calling tool with args:', args);
    const result = await client.callTool({ name: searchTool.name, arguments: args });
    await client.close();
    res.json({ tool: searchTool.name, result });
  } catch (err) {
    console.error('Tours error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Generic tool call proxy
app.post('/api/call', async (req, res) => {
  const { tool, args } = req.body;
  try {
    const client = await createClient();
    const result = await client.callTool({ name: tool, arguments: args || {} });
    await client.close();
    res.json(result);
  } catch (err) {
    console.error('Call error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`TourRadar app running → http://localhost:${PORT}`));
