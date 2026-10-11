#!/usr/bin/env node
/**
 * TokeniCode Computer-Use MCP Server Bridge
 *
 * Implements standard MCP (Model Context Protocol) over stdio.
 * Bridges Claude Code CLI tool calls to the native Windows automation
 * engine at ~/.claude/.runtime/win_helper.py.
 */

const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Configuration with sensible defaults for Windows
const USER_PROFILE = process.env.USERPROFILE || os.homedir();
const VENV_PYTHON = path.join(USER_PROFILE, '.claude', '.runtime', 'venv', 'Scripts', 'python.exe');
const DEFAULT_PYTHON = process.env.TOKENICODE_CUA_PYTHON || VENV_PYTHON;
const DEFAULT_HELPER = process.env.TOKENICODE_CUA_HELPER ||
  path.join(USER_PROFILE, '.claude', '.runtime', 'win_helper.py');

function getPythonPath() {
  if (process.env.TOKENICODE_CUA_PYTHON && fs.existsSync(process.env.TOKENICODE_CUA_PYTHON)) {
    return process.env.TOKENICODE_CUA_PYTHON;
  }
  if (fs.existsSync(VENV_PYTHON)) {
    return VENV_PYTHON;
  }
  return 'python';
}

function getHelperPath() {
  if (fs.existsSync(DEFAULT_HELPER)) {
    return DEFAULT_HELPER;
  }
  const alt = path.join(process.cwd(), 'win_helper.py');
  if (fs.existsSync(alt)) return alt;
  return DEFAULT_HELPER;
}

// Call win_helper.py with a JSON payload
function invokeHelper(command, payload = {}) {
  return new Promise((resolve, reject) => {
    const pythonBin = getPythonPath();
    const helperScript = getHelperPath();

    if (!fs.existsSync(helperScript)) {
      return reject(new Error(`Helper script not found at ${helperScript}`));
    }

    const payloadStr = JSON.stringify(payload);
    const args = [helperScript, command, '--payload', payloadStr];

    const child = spawn(pythonBin, args, {
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONDONTWRITEBYTECODE: '1',
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString('utf-8'); });
    child.stderr.on('data', (d) => { stderr += d.toString('utf-8'); });

    child.on('close', (code) => {
      try {
        const trimmed = stdout.trim();
        if (!trimmed) {
          return resolve({ ok: false, error: stderr || `Process exited with code ${code}` });
        }
        // Extract the last line or find line that starts with {"ok"
        const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
        let jsonLine = lines.find(l => l.startsWith('{"ok":')) || lines[lines.length - 1];
        const parsed = JSON.parse(jsonLine);
        resolve(parsed);
      } catch (err) {
        resolve({
          ok: false,
          error: `Failed to parse helper output: ${err.message}. Raw: ${stdout.slice(0, 500)}`,
          stderr: stderr.slice(0, 500),
        });
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

// MCP Tools schema definitions
const TOOLS = [
  {
    name: 'screenshot',
    description: 'Capture screenshot of display. Returns JPEG image.',
    inputSchema: {
      type: 'object',
      properties: {
        display: { type: 'string', description: 'Monitor name or ID' },
        save_to_disk: { type: 'boolean', description: 'Save image to temp file' },
      },
    },
  },
  {
    name: 'zoom',
    description: 'Capture high-resolution cropped region of previous screen. Region is [x0, y0, x1, y1].',
    inputSchema: {
      type: 'object',
      properties: {
        region: {
          type: 'array',
          items: { type: 'number' },
          minItems: 4,
          maxItems: 4,
          description: '[x0, y0, x1, y1] coordinates',
        },
      },
      required: ['region'],
    },
  },
  {
    name: 'cursor_position',
    description: 'Get current mouse cursor physical coordinates (x, y).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'mouse_move',
    description: 'Move mouse cursor to coordinates [x, y] without clicking.',
    inputSchema: {
      type: 'object',
      properties: {
        coordinate: {
          type: 'array',
          items: { type: 'number' },
          minItems: 2,
          maxItems: 2,
          description: '[x, y]',
        },
      },
      required: ['coordinate'],
    },
  },
  {
    name: 'left_click',
    description: 'Left-click at given [x, y] coordinate.',
    inputSchema: {
      type: 'object',
      properties: {
        coordinate: {
          type: 'array',
          items: { type: 'number' },
          minItems: 2,
          maxItems: 2,
          description: '[x, y]',
        },
        text: { type: 'string', description: 'Modifier keys to hold during click (e.g. shift, ctrl)' },
      },
      required: ['coordinate'],
    },
  },
  {
    name: 'double_click',
    description: 'Double-click at given [x, y] coordinate.',
    inputSchema: {
      type: 'object',
      properties: {
        coordinate: {
          type: 'array',
          items: { type: 'number' },
          minItems: 2,
          maxItems: 2,
        },
        text: { type: 'string' },
      },
      required: ['coordinate'],
    },
  },
  {
    name: 'triple_click',
    description: 'Triple-click at given [x, y] coordinate.',
    inputSchema: {
      type: 'object',
      properties: {
        coordinate: {
          type: 'array',
          items: { type: 'number' },
          minItems: 2,
          maxItems: 2,
        },
        text: { type: 'string' },
      },
      required: ['coordinate'],
    },
  },
  {
    name: 'right_click',
    description: 'Right-click at given [x, y] coordinate to open context menu.',
    inputSchema: {
      type: 'object',
      properties: {
        coordinate: {
          type: 'array',
          items: { type: 'number' },
          minItems: 2,
          maxItems: 2,
        },
        text: { type: 'string' },
      },
      required: ['coordinate'],
    },
  },
  {
    name: 'middle_click',
    description: 'Middle-click at given [x, y] coordinate.',
    inputSchema: {
      type: 'object',
      properties: {
        coordinate: {
          type: 'array',
          items: { type: 'number' },
          minItems: 2,
          maxItems: 2,
        },
      },
      required: ['coordinate'],
    },
  },
  {
    name: 'left_click_drag',
    description: 'Click and drag mouse from current/start point to destination coordinate.',
    inputSchema: {
      type: 'object',
      properties: {
        coordinate: {
          type: 'array',
          items: { type: 'number' },
          minItems: 2,
          maxItems: 2,
          description: 'Destination [x, y]',
        },
        start_coordinate: {
          type: 'array',
          items: { type: 'number' },
          minItems: 2,
          maxItems: 2,
          description: 'Optional start [x, y]',
        },
      },
      required: ['coordinate'],
    },
  },
  {
    name: 'left_mouse_down',
    description: 'Press and hold left mouse button down.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'left_mouse_up',
    description: 'Release left mouse button.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'scroll',
    description: 'Scroll wheel at given coordinate.',
    inputSchema: {
      type: 'object',
      properties: {
        coordinate: {
          type: 'array',
          items: { type: 'number' },
          minItems: 2,
          maxItems: 2,
        },
        scroll_direction: { type: 'string', enum: ['up', 'down', 'left', 'right'] },
        scroll_amount: { type: 'number', description: 'Scroll step count' },
      },
      required: ['coordinate', 'scroll_direction', 'scroll_amount'],
    },
  },
  {
    name: 'type',
    description: 'Type text into currently focused window.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to type' },
      },
      required: ['text'],
    },
  },
  {
    name: 'key',
    description: 'Press key or key chord combination (e.g. return, ctrl+c, alt+tab).',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Key name or combination' },
        repeat: { type: 'number', default: 1 },
      },
      required: ['text'],
    },
  },
  {
    name: 'hold_key',
    description: 'Hold key combination down for duration in seconds, then release.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Key combination' },
        duration: { type: 'number', description: 'Duration in seconds' },
      },
      required: ['text', 'duration'],
    },
  },
  {
    name: 'wait',
    description: 'Wait for specified seconds.',
    inputSchema: {
      type: 'object',
      properties: {
        duration: { type: 'number', description: 'Seconds to wait' },
      },
      required: ['duration'],
    },
  },
  {
    name: 'open_application',
    description: 'Bring an application window to foreground or launch it.',
    inputSchema: {
      type: 'object',
      properties: {
        app: { type: 'string', description: 'App name or exe (e.g. notepad, chrome)' },
      },
      required: ['app'],
    },
  },
  {
    name: 'read_clipboard',
    description: 'Read current text content from system clipboard.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'write_clipboard',
    description: 'Write text to system clipboard.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to write' },
      },
      required: ['text'],
    },
  },
  {
    name: 'computer_batch',
    description: 'Execute a batch sequence of computer actions sequentially in one round trip.',
    inputSchema: {
      type: 'object',
      properties: {
        actions: {
          type: 'array',
          items: { type: 'object' },
          description: 'List of action objects',
        },
      },
      required: ['actions'],
    },
  },
];

// Execute a single action against win_helper.py
async function executeAction(name, args) {
  switch (name) {
    case 'screenshot': {
      const payload = {};
      if (args.display) payload.displayId = args.display;
      const resp = await invokeHelper('screenshot', payload);
      if (!resp.ok) {
        return { isError: true, content: [{ type: 'text', text: `Screenshot failed: ${resp.error || JSON.stringify(resp)}` }] };
      }
      const data = resp.result || {};
      const base64Data = data.base64 || '';
      return {
        content: [
          { type: 'image', data: base64Data, mimeType: 'image/jpeg' },
          {
            type: 'text',
            text: `Screenshot captured (${data.width || 'auto'}x${data.height || 'auto'}, display: ${data.displayId || 'primary'}).`,
          },
        ],
      };
    }

    case 'zoom': {
      const [x0, y0, x1, y1] = args.region || [0, 0, 100, 100];
      const payload = {
        x: Math.round(x0),
        y: Math.round(y0),
        width: Math.round(Math.max(1, x1 - x0)),
        height: Math.round(Math.max(1, y1 - y0)),
      };
      const resp = await invokeHelper('zoom', payload);
      if (!resp.ok) {
        return { isError: true, content: [{ type: 'text', text: `Zoom failed: ${resp.error}` }] };
      }
      return {
        content: [
          { type: 'image', data: resp.result?.base64 || '', mimeType: 'image/jpeg' },
          { type: 'text', text: `Region zoom captured at [${x0}, ${y0}, ${x1}, ${y1}].` },
        ],
      };
    }

    case 'cursor_position': {
      const resp = await invokeHelper('cursor_position', {});
      return { content: [{ type: 'text', text: JSON.stringify(resp.result || resp) }] };
    }

    case 'mouse_move': {
      const [x, y] = args.coordinate || [0, 0];
      const resp = await invokeHelper('move_mouse', { x, y, animate: true });
      return { content: [{ type: 'text', text: resp.ok ? `Mouse moved to (${x}, ${y})` : `Failed: ${resp.error}` }] };
    }

    case 'left_click':
    case 'right_click':
    case 'double_click':
    case 'triple_click':
    case 'middle_click': {
      const [x, y] = args.coordinate || [0, 0];
      let button = 'left';
      let count = 1;
      if (name === 'right_click') button = 'right';
      if (name === 'middle_click') button = 'middle';
      if (name === 'double_click') count = 2;
      if (name === 'triple_click') count = 3;

      const modifiers = args.text ? args.text.split('+').map(s => s.trim().toLowerCase()) : [];
      const resp = await invokeHelper('click', { x, y, button, count, modifiers, animate: true });
      return { content: [{ type: 'text', text: resp.ok ? `${name} at (${x}, ${y}) succeeded.` : `Click failed: ${resp.error}` }] };
    }

    case 'left_click_drag': {
      const [toX, toY] = args.coordinate || [0, 0];
      const payload = { to: { x: toX, y: toY }, animate: true };
      if (args.start_coordinate) {
        payload.from = { x: args.start_coordinate[0], y: args.start_coordinate[1] };
      }
      const resp = await invokeHelper('drag', payload);
      return { content: [{ type: 'text', text: resp.ok ? `Dragged to (${toX}, ${toY}).` : `Drag failed: ${resp.error}` }] };
    }

    case 'left_mouse_down': {
      const resp = await invokeHelper('mouse_down', {});
      return { content: [{ type: 'text', text: resp.ok ? 'Left button held down.' : `Failed: ${resp.error}` }] };
    }

    case 'left_mouse_up': {
      const resp = await invokeHelper('mouse_up', {});
      return { content: [{ type: 'text', text: resp.ok ? 'Left button released.' : `Failed: ${resp.error}` }] };
    }

    case 'scroll': {
      const [x, y] = args.coordinate || [0, 0];
      let deltaY = 0;
      let deltaX = 0;
      const amt = (args.scroll_amount || 1) * 120;
      if (args.scroll_direction === 'up') deltaY = amt;
      if (args.scroll_direction === 'down') deltaY = -amt;
      if (args.scroll_direction === 'left') deltaX = -amt;
      if (args.scroll_direction === 'right') deltaX = amt;

      const resp = await invokeHelper('scroll', { x, y, deltaX, deltaY, animate: true });
      return { content: [{ type: 'text', text: resp.ok ? `Scrolled ${args.scroll_direction} by ${args.scroll_amount}.` : `Scroll failed: ${resp.error}` }] };
    }

    case 'type': {
      const resp = await invokeHelper('type', { text: args.text || '' });
      return { content: [{ type: 'text', text: resp.ok ? `Typed text successfully.` : `Type failed: ${resp.error}` }] };
    }

    case 'key': {
      const resp = await invokeHelper('key', { keySequence: args.text || '', repeat: args.repeat || 1 });
      return { content: [{ type: 'text', text: resp.ok ? `Key ${args.text} sent.` : `Key failed: ${resp.error}` }] };
    }

    case 'hold_key': {
      const durationMs = Math.round((args.duration || 1) * 1000);
      const keyNames = (args.text || '').split('+').map(k => k.trim());
      const resp = await invokeHelper('hold_key', { keyNames, durationMs });
      return { content: [{ type: 'text', text: resp.ok ? `Held keys ${args.text} for ${args.duration}s.` : `Hold failed: ${resp.error}` }] };
    }

    case 'wait': {
      const durationMs = Math.round((args.duration || 1) * 1000);
      await new Promise(r => setTimeout(r, durationMs));
      return { content: [{ type: 'text', text: `Waited ${args.duration} seconds.` }] };
    }

    case 'open_application': {
      const resp = await invokeHelper('open_app', { bundleId: args.app || '' });
      return { content: [{ type: 'text', text: resp.ok ? `Launched/focused ${args.app}.` : `Failed to open ${args.app}: ${resp.error}` }] };
    }

    case 'read_clipboard': {
      const resp = await invokeHelper('read_clipboard', {});
      return { content: [{ type: 'text', text: resp.ok ? String(resp.result || '') : `Clipboard read failed: ${resp.error}` }] };
    }

    case 'write_clipboard': {
      const resp = await invokeHelper('write_clipboard', { text: args.text || '' });
      return { content: [{ type: 'text', text: resp.ok ? 'Text written to clipboard.' : `Clipboard write failed: ${resp.error}` }] };
    }

    case 'computer_batch': {
      const actions = args.actions || [];
      const results = [];
      for (const act of actions) {
        const actName = act.action;
        const res = await executeAction(actName, act);
        results.push({ action: actName, res });
      }
      return { content: [{ type: 'text', text: `Executed ${results.length} actions in batch.` }] };
    }

    default:
      return { isError: true, content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
  }
}

// JSON-RPC 2.0 stdio loop
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

function sendResponse(id, result, error) {
  const msg = { jsonrpc: '2.0', id };
  if (error) {
    msg.error = error;
  } else {
    msg.result = result;
  }
  process.stdout.write(JSON.stringify(msg) + '\n');
}

rl.on('line', async (line) => {
  const text = line.trim();
  if (!text) return;

  try {
    const req = JSON.parse(text);
    const { id, method, params } = req;

    if (method === 'initialize') {
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'tokenicode-computer-use', version: '0.1.0' },
      });
      return;
    }

    if (method === 'notifications/initialized') {
      return; // No response needed
    }

    if (method === 'tools/list') {
      sendResponse(id, { tools: TOOLS });
      return;
    }

    if (method === 'tools/call') {
      const { name, arguments: args = {} } = params || {};
      try {
        const actionResult = await executeAction(name, args);
        sendResponse(id, actionResult);
      } catch (err) {
        sendResponse(id, {
          isError: true,
          content: [{ type: 'text', text: `Action error: ${err.message}` }],
        });
      }
      return;
    }

    if (id !== undefined) {
      sendResponse(id, null, { code: -32601, message: `Method not found: ${method}` });
    }
  } catch (err) {
    // Malformed JSON
  }
});
