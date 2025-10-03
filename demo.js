import ActiveTransferClient from './client.js';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load configuration
let fullConfig;
let selectedEnvironment;
let client;

try {
  const configData = fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8');
  fullConfig = JSON.parse(configData);
} catch (error) {
  console.error('Error loading config.json:', error.message);
  console.error('Please ensure config.json exists and is valid JSON');
  process.exit(1);
}

/**
 * Select environment
 */
async function selectEnvironment() {
  const envChoices = Object.keys(fullConfig.environments).map(key => ({
    name: `${fullConfig.environments[key].name} (${fullConfig.environments[key].server.host}:${fullConfig.environments[key].server.port})`,
    value: key
  }));

  const { environment } = await inquirer.prompt([
    {
      type: 'list',
      name: 'environment',
      message: '🌍 Select Active Transfer environment:',
      choices: envChoices,
      default: fullConfig.defaultEnvironment
    }
  ]);

  selectedEnvironment = environment;
  const envConfig = fullConfig.environments[environment];

  // Create config object with the selected environment
  const config = {
    server: envConfig.server,
    auth: envConfig.auth,
    defaults: fullConfig.defaults
  };

  // Initialize client with selected environment
  client = new ActiveTransferClient(config);

  return config;
}

// Display banner
function displayBanner(config) {
  console.clear();
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   webMethods Active Transfer - Demo Client            ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`\n🌍 Environment: ${fullConfig.environments[selectedEnvironment].name}`);
  console.log(`🌐 Server: ${config.server.host}:${config.server.port}`);
  console.log(`👤 User: ${config.auth.username}\n`);
}

// Main menu options
const mainMenuChoices = [
  { name: '📤 Upload File', value: 'upload' },
  { name: '📥 Download File', value: 'download' },
  { name: '📋 List Files', value: 'list' },
  { name: '📁 Create Folder', value: 'createFolder' },
  { name: '🗑️  Delete File/Folder', value: 'delete' },
  { name: '✏️  Rename File/Folder', value: 'rename' },
  { name: '🔍 Check if Path is File', value: 'isFile' },
  { name: '🔄 Switch Environment', value: 'switchEnv' },
  { name: '❌ Exit', value: 'exit' }
];

/**
 * Upload file workflow
 */
async function uploadWorkflow() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'localPath',
      message: 'Enter local file path to upload:',
      validate: (input) => {
        if (!input) return 'Please provide a file path';
        if (!fs.existsSync(input)) return 'File does not exist';
        if (!fs.statSync(input).isFile()) return 'Path must be a file';
        return true;
      }
    },
    {
      type: 'input',
      name: 'remotePath',
      message: 'Enter remote destination path (default: /):',
      default: '/'
    }
  ]);

  console.log('\n⏳ Uploading file...');
  const result = await client.uploadFile(answers.localPath, answers.remotePath);

  if (result.success) {
    console.log('✅', result.message);
    console.log('📊 Response:', JSON.stringify(result.data, null, 2));
  } else {
    console.log('❌ Upload failed:', result.message);
    if (result.details) {
      console.log('Details:', JSON.stringify(result.details, null, 2));
    }
  }
}

/**
 * Download file workflow
 */
async function downloadWorkflow() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'remotePath',
      message: 'Enter remote file path to download:',
      validate: (input) => input ? true : 'Please provide a remote path'
    },
    {
      type: 'input',
      name: 'localPath',
      message: 'Enter local destination path (with filename):',
      validate: (input) => {
        if (!input) return 'Please provide a destination path';
        const dir = path.dirname(input);
        if (!fs.existsSync(dir)) return 'Destination directory does not exist';
        return true;
      }
    }
  ]);

  console.log('\n⏳ Downloading file...');
  const result = await client.downloadFile(answers.remotePath, answers.localPath);

  if (result.success) {
    console.log('✅', result.message);
    console.log('📁 Saved to:', result.localPath);
  } else {
    console.log('❌ Download failed:', result.message);
  }
}

/**
 * List files workflow
 */
async function listFilesWorkflow() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'remotePath',
      message: 'Enter directory path to list (default: /):',
      default: '/'
    }
  ]);

  console.log('\n⏳ Listing files...');
  const result = await client.listFiles(answers.remotePath);

  if (result.success) {
    console.log('✅', result.message);
    console.log('\n📂 Files and Folders:');
    console.log(JSON.stringify(result.data, null, 2));
  } else {
    console.log('❌ List failed:', result.message);
  }
}

/**
 * Create folder workflow
 */
async function createFolderWorkflow() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'folderPath',
      message: 'Enter folder path to create:',
      validate: (input) => input ? true : 'Please provide a folder path'
    }
  ]);

  console.log('\n⏳ Creating folder...');
  const result = await client.createFolder(answers.folderPath);

  if (result.success) {
    console.log('✅', result.message);
    console.log('📊 Response:', JSON.stringify(result.data, null, 2));
  } else {
    console.log('❌ Create folder failed:', result.message);
  }
}

/**
 * Delete file/folder workflow
 */
async function deleteWorkflow() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'remotePath',
      message: 'Enter path to delete:',
      validate: (input) => input ? true : 'Please provide a path'
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to delete this?',
      default: false
    }
  ]);

  if (!answers.confirm) {
    console.log('❌ Delete cancelled');
    return;
  }

  console.log('\n⏳ Deleting...');
  const result = await client.delete(answers.remotePath);

  if (result.success) {
    console.log('✅', result.message);
    console.log('📊 Response:', JSON.stringify(result.data, null, 2));
  } else {
    console.log('❌ Delete failed:', result.message);
  }
}

/**
 * Rename file/folder workflow
 */
async function renameWorkflow() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'oldPath',
      message: 'Enter current path:',
      validate: (input) => input ? true : 'Please provide the current path'
    },
    {
      type: 'input',
      name: 'newPath',
      message: 'Enter new path/name:',
      validate: (input) => input ? true : 'Please provide the new path'
    }
  ]);

  console.log('\n⏳ Renaming...');
  const result = await client.rename(answers.oldPath, answers.newPath);

  if (result.success) {
    console.log('✅', result.message);
    console.log('📊 Response:', JSON.stringify(result.data, null, 2));
  } else {
    console.log('❌ Rename failed:', result.message);
  }
}

/**
 * Check if file workflow
 */
async function isFileWorkflow() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'remotePath',
      message: 'Enter path to check:',
      validate: (input) => input ? true : 'Please provide a path'
    }
  ]);

  console.log('\n⏳ Checking path...');
  const result = await client.isFile(answers.remotePath);

  if (result.success) {
    console.log('✅', result.message);
    console.log('📊 Response:', JSON.stringify(result.data, null, 2));
  } else {
    console.log('❌ Check failed:', result.message);
  }
}

/**
 * Main menu loop
 */
async function mainMenu(config) {
  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '\nSelect an action:',
        choices: mainMenuChoices
      }
    ]);

    console.log('\n' + '─'.repeat(60) + '\n');

    switch (action) {
      case 'upload':
        await uploadWorkflow();
        break;
      case 'download':
        await downloadWorkflow();
        break;
      case 'list':
        await listFilesWorkflow();
        break;
      case 'createFolder':
        await createFolderWorkflow();
        break;
      case 'delete':
        await deleteWorkflow();
        break;
      case 'rename':
        await renameWorkflow();
        break;
      case 'isFile':
        await isFileWorkflow();
        break;
      case 'switchEnv':
        const newConfig = await selectEnvironment();
        displayBanner(newConfig);
        continue;
      case 'exit':
        console.log('\n👋 Goodbye!\n');
        process.exit(0);
    }

    console.log('\n' + '─'.repeat(60));

    // Pause before showing menu again
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: 'Press Enter to continue...'
      }
    ]);
  }
}

// Start the demo
async function start() {
  const config = await selectEnvironment();
  displayBanner(config);
  await mainMenu(config);
}

start().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
