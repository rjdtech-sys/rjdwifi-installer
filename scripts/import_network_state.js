const db = require('../lib/db');
const network = require('../lib/network');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function sync() {
  console.log('Starting Network State Import...');
  
  // 1. Get Interfaces
  const interfaces = await network.getInterfaces();
  console.log('Found interfaces:', interfaces.map(i => i.name).join(', '));

  // 2. Sync VLANs
  const vlans = interfaces.filter(i => i.type === 'vlan');
  for (const vlan of vlans) {
    const parts = vlan.name.split('.');
    if (parts.length === 2) {
      const parent = parts[0];
      const id = parseInt(parts[1]);
      console.log(`Importing VLAN: ${vlan.name} (Parent: ${parent}, ID: ${id})`);
      await db.run('INSERT OR IGNORE INTO vlans (name, parent, id) VALUES (?, ?, ?)', [vlan.name, parent, id]);
    } else {
      console.log(`Skipping VLAN ${vlan.name} (non-standard naming)`);
    }
  }

  // 3. Sync Bridges
  const bridges = interfaces.filter(i => i.type === 'bridge');
  
  // Get full link info to find bridge members
  let linkInfo = [];
  try {
    const { stdout } = await execPromise('ip -j link show');
    linkInfo = JSON.parse(stdout);
  } catch (e) { console.error('Failed to get link info:', e); }

  for (const bridge of bridges) {
    // Find members
    const members = linkInfo
      .filter(l => l.master === bridge.name)
      .map(l => l.ifname);
    
    console.log(`Importing Bridge: ${bridge.name} (Members: ${members.join(', ')})`);
    await db.run('INSERT OR IGNORE INTO bridges (name, members, stp) VALUES (?, ?, ?)', 
      [bridge.name, JSON.stringify(members), 0]);
  }

  console.log('Import Complete.');
}

sync().catch(console.error);
