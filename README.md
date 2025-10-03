# webMethods Active Transfer Demo Client

A Node.js HTTP client demo for webMethods Active Transfer (MFT) that showcases file upload, download, and management capabilities through an interactive CLI interface.

## Features

- 📤 **File Upload** - Upload files to Active Transfer server
- 📥 **File Download** - Download files from Active Transfer server
- 📋 **List Files** - Browse directories and view file listings
- 📁 **Create Folder** - Create new folders on the server
- 🗑️ **Delete** - Remove files or folders
- ✏️ **Rename** - Rename or move files and folders
- 🔍 **Verify Path** - Check if a path is a file

## Prerequisites

- Node.js (version 14 or higher)
- npm or yarn
- Access to a webMethods Active Transfer server

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure your Active Transfer server details in `config.json`:
```json
{
  "server": {
    "host": "169.63.187.226",
    "port": 5566,
    "protocol": "http"
  },
  "auth": {
    "username": "your-username",
    "password": "your-password"
  },
  "defaults": {
    "uploadPath": "/uploads",
    "downloadPath": "/downloads"
  }
}
```

## Usage

### Start the Interactive Demo

```bash
npm start
```

This launches an interactive CLI menu where you can:
- Select operations from a menu
- Follow prompts to provide required parameters
- View responses and results in real-time

### Use the Client Programmatically

You can also import and use the `ActiveTransferClient` class directly in your own code:

```javascript
import ActiveTransferClient from './client.js';
import fs from 'fs';

// Load config
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// Create client instance
const client = new ActiveTransferClient(config);

// Upload a file
const uploadResult = await client.uploadFile('./myfile.txt', '/uploads/');
console.log(uploadResult);

// Download a file
const downloadResult = await client.downloadFile('/uploads/myfile.txt', './downloaded.txt');
console.log(downloadResult);

// List files in a directory
const listResult = await client.listFiles('/uploads/');
console.log(listResult);

// Create a folder
const folderResult = await client.createFolder('/uploads/newfolder');
console.log(folderResult);

// Delete a file or folder
const deleteResult = await client.delete('/uploads/oldfile.txt');
console.log(deleteResult);

// Rename a file or folder
const renameResult = await client.rename('/uploads/oldname.txt', '/uploads/newname.txt');
console.log(renameResult);

// Check if path is a file
const isFileResult = await client.isFile('/uploads/myfile.txt');
console.log(isFileResult);
```

## API Methods

### `uploadFile(localPath, remotePath)`
Uploads a file to the Active Transfer server.

**Parameters:**
- `localPath` (string): Local file path to upload
- `remotePath` (string): Remote destination path (default: '/')

**Returns:** Promise with upload result

### `downloadFile(remotePath, localPath)`
Downloads a file from the Active Transfer server.

**Parameters:**
- `remotePath` (string): Remote file path to download
- `localPath` (string): Local destination path (optional, returns stream if not provided)

**Returns:** Promise with download result

### `listFiles(remotePath)`
Lists files and folders in a directory.

**Parameters:**
- `remotePath` (string): Remote directory path (default: '/')

**Returns:** Promise with file listing

### `createFolder(folderPath)`
Creates a new folder on the server.

**Parameters:**
- `folderPath` (string): Path for the new folder

**Returns:** Promise with creation result

### `delete(remotePath)`
Deletes a file or folder.

**Parameters:**
- `remotePath` (string): Path to delete

**Returns:** Promise with deletion result

### `rename(oldPath, newPath)`
Renames or moves a file or folder.

**Parameters:**
- `oldPath` (string): Current path
- `newPath` (string): New path/name

**Returns:** Promise with rename result

### `isFile(remotePath)`
Checks if a path is a file.

**Parameters:**
- `remotePath` (string): Path to check

**Returns:** Promise with verification result

## Configuration

The `config.json` file contains all configurable settings:

- **Server Settings**: Host, port, and protocol for your Active Transfer server
- **Authentication**: Username and password for Basic Auth
- **Defaults**: Default paths for uploads and downloads

You can easily switch between different environments by modifying this file.

## Error Handling

All API methods return a standardized response format:

**Success Response:**
```javascript
{
  success: true,
  message: "Operation completed successfully",
  data: { /* response data */ }
}
```

**Error Response:**
```javascript
{
  success: false,
  operation: "Operation Name",
  message: "Error message",
  status: 500,
  statusText: "Internal Server Error",
  details: { /* error details */ }
}
```

## Notes

- For single-VFS users, all paths should be relative to the VFS root
- The upload API only supports form-data format
- Large file transfers may require timeout adjustments in the client configuration
- Ensure your user account has appropriate VFS permissions for the operations you want to perform

## Troubleshooting

**Connection Issues:**
- Verify the server host and port in `config.json`
- Check network connectivity to the Active Transfer server
- Ensure the server is running and accessible

**Authentication Errors:**
- Verify username and password in `config.json`
- Ensure the user has appropriate permissions in Active Transfer

**File Operation Errors:**
- Check that paths are correct and relative to VFS root
- Verify the user has VFS permissions for the operation
- Ensure the target directory exists for upload operations

## License

ISC

## Support

For webMethods Active Transfer documentation, visit:
https://www.ibm.com/docs/en/webmethods-activetransfer/10.15.0
