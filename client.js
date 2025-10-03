import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ActiveTransfer HTTP Client
 * A client for interacting with webMethods Active Transfer REST APIs
 */
class ActiveTransferClient {
  constructor(config) {
    this.config = config;
    this.baseUrl = `${config.server.protocol}://${config.server.host}:${config.server.port}`;
    this.auth = {
      username: config.auth.username,
      password: config.auth.password
    };
    // Detect if this is a SaaS environment based on hostname
    this.isSaaS = config.server.host.includes('ipaas.automation.ibm.com');
    // Store session cookies for SaaS
    this.sessionCookies = null;
  }

  /**
   * Login to SaaS environment and get session cookies
   */
  async loginSaaS() {
    if (this.sessionCookies) {
      return; // Already logged in
    }

    try {
      const axiosInstance = axios.create({
        baseURL: this.baseUrl,
        timeout: 30000,
        withCredentials: true
      });

      console.log('\n🔐 Logging in to SaaS environment...');

      // Try to login using Basic Auth header for SaaS
      const response = await axiosInstance.post('/WebInterface/function/',
        `command=login&username=${encodeURIComponent(this.auth.username)}&password=${encodeURIComponent(this.auth.password)}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest'
          }
        }
      );

      // Extract cookies from response
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        this.sessionCookies = cookies.map(cookie => cookie.split(';')[0]).join('; ');
        console.log('✅ Login successful\n');
      }
    } catch (error) {
      console.error('❌ SaaS login failed:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with SaaS environment');
    }
  }

  /**
   * Create axios instance with authentication
   */
  getAxiosInstance(customTimeout = null) {
    const config = {
      baseURL: this.baseUrl,
      timeout: customTimeout || 30000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      withCredentials: true
    };

    // For SaaS, use session cookies; for on-prem, use Basic Auth
    if (this.isSaaS && this.sessionCookies) {
      config.headers = {
        'Cookie': this.sessionCookies
      };
    } else if (!this.isSaaS) {
      config.auth = this.auth;
    }

    return axios.create(config);
  }

  /**
   * Upload a file to Active Transfer server
   * @param {string} filePath - Local file path to upload
   * @param {string} remotePath - Remote destination path (relative to VFS root)
   * @returns {Promise<Object>} Response data
   */
  async uploadFile(filePath, remotePath = '/') {
    if (this.isSaaS) {
      return this.uploadFileSaaS(filePath, remotePath);
    } else {
      return this.uploadFileOnPrem(filePath, remotePath);
    }
  }

  /**
   * Upload file for SaaS environment
   */
  async uploadFileSaaS(filePath, remotePath = '/') {
    // Ensure we're logged in first
    await this.loginSaaS();

    const fileName = path.basename(filePath);
    const fileStats = fs.statSync(filePath);
    const fileSize = fileStats.size;

    const requestInfo = {
      endpoint: '/WebInterface/function/',
      method: 'POST',
      filePath: filePath,
      remotePath: remotePath,
      fileName: fileName,
      fileSize: fileSize,
      baseUrl: this.baseUrl,
      username: this.auth.username,
      type: 'SaaS'
    };

    try {
      const form = new FormData();

      // Use stream for better memory efficiency with large files
      const fileStream = fs.createReadStream(filePath);

      // SaaS-specific parameters from the curl
      form.append('uploadPath', remotePath.endsWith('/') ? remotePath : remotePath + '/');
      form.append('the_action', 'STOR');
      form.append('file_lWsx_SINGLE_FILE_POST', fileStream, {
        filename: fileName,
        knownLength: fileSize
      });

      // Calculate timeout based on file size (at least 5 minutes for large files)
      // Assume 10 MB/s upload speed, add 2x buffer + 60s base
      const estimatedUploadTime = (fileSize / (10 * 1024 * 1024)) * 1000; // ms
      const timeoutMs = Math.max(300000, estimatedUploadTime * 2 + 60000); // min 5 minutes

      const axiosInstance = this.getAxiosInstance(timeoutMs);

      console.log('\n🔍 REQUEST DEBUG INFO (SaaS):');
      console.log('━'.repeat(60));
      console.log('URL:', `${this.baseUrl}/WebInterface/function/`);
      console.log('Method: POST');
      console.log('Username:', this.auth.username);
      console.log('File:', fileName);
      console.log('File Size:', (fileSize / 1024 / 1024).toFixed(2), 'MB');
      console.log('Upload Path:', remotePath);
      console.log('Action: STOR');
      console.log('Content-Type:', form.getHeaders()['content-type']);
      console.log('Transfer: Streaming (chunked)');
      console.log('Timeout:', (timeoutMs / 1000).toFixed(0), 'seconds');
      console.log('━'.repeat(60) + '\n');

      const response = await axiosInstance.post('/WebInterface/function/', form, {
        headers: {
          ...form.getHeaders(),
          'X-Requested-With': 'XMLHttpRequest'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: timeoutMs,
        // Optional: Add progress tracking
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            process.stdout.write(`\r📤 Upload progress: ${percentCompleted}% (${(progressEvent.loaded / 1024 / 1024).toFixed(2)} MB / ${(progressEvent.total / 1024 / 1024).toFixed(2)} MB)`);
          }
        }
      });

      console.log('\n'); // New line after progress

      return {
        success: true,
        message: 'File uploaded successfully (SaaS)',
        data: response.data
      };
    } catch (error) {
      console.log('\n'); // New line after progress on error
      return this.handleError('Upload (SaaS)', error, requestInfo);
    }
  }

  /**
   * Upload file for On-Premises environment
   */
  async uploadFileOnPrem(filePath, remotePath = '/') {
    const fileName = path.basename(filePath);
    const fileStats = fs.statSync(filePath);
    const fileSize = fileStats.size;

    const requestInfo = {
      endpoint: '/api/upload',
      method: 'POST',
      filePath: filePath,
      remotePath: remotePath,
      fileName: fileName,
      fileSize: fileSize,
      baseUrl: this.baseUrl,
      username: this.auth.username,
      type: 'On-Premises'
    };

    try {
      const form = new FormData();

      // Use stream for better memory efficiency with large files
      const fileStream = fs.createReadStream(filePath);

      form.append('file', fileStream, {
        filename: fileName,
        knownLength: fileSize
      });
      form.append('path', remotePath);

      // Calculate timeout based on file size (at least 5 minutes for large files)
      // Assume 10 MB/s upload speed, add 2x buffer + 60s base
      const estimatedUploadTime = (fileSize / (10 * 1024 * 1024)) * 1000; // ms
      const timeoutMs = Math.max(300000, estimatedUploadTime * 2 + 60000); // min 5 minutes

      const axiosInstance = this.getAxiosInstance(timeoutMs);

      console.log('\n🔍 REQUEST DEBUG INFO (On-Premises):');
      console.log('━'.repeat(60));
      console.log('URL:', `${this.baseUrl}/api/upload`);
      console.log('Method: POST');
      console.log('Username:', this.auth.username);
      console.log('File:', fileName);
      console.log('File Size:', (fileSize / 1024 / 1024).toFixed(2), 'MB');
      console.log('Remote Path:', remotePath);
      console.log('Content-Type:', form.getHeaders()['content-type']);
      console.log('Transfer: Streaming (chunked)');
      console.log('Timeout:', (timeoutMs / 1000).toFixed(0), 'seconds');
      console.log('━'.repeat(60) + '\n');

      const response = await axiosInstance.post('/api/upload', form, {
        headers: {
          ...form.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: timeoutMs,
        // Optional: Add progress tracking
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            process.stdout.write(`\r📤 Upload progress: ${percentCompleted}% (${(progressEvent.loaded / 1024 / 1024).toFixed(2)} MB / ${(progressEvent.total / 1024 / 1024).toFixed(2)} MB)`);
          }
        }
      });

      console.log('\n'); // New line after progress

      return {
        success: true,
        message: 'File uploaded successfully (On-Premises)',
        data: response.data
      };
    } catch (error) {
      console.log('\n'); // New line after progress on error
      return this.handleError('Upload (On-Premises)', error, requestInfo);
    }
  }

  /**
   * Download a file from Active Transfer server
   * @param {string} remotePath - Remote file path to download
   * @param {string} localPath - Local destination path (optional)
   * @returns {Promise<Object>} Response data
   */
  async downloadFile(remotePath, localPath = null) {
    try {
      const axiosInstance = this.getAxiosInstance();

      const response = await axiosInstance.post('/api/download', {
        path: remotePath
      }, {
        responseType: 'stream'
      });

      if (localPath) {
        const writer = fs.createWriteStream(localPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
          writer.on('finish', () => {
            resolve({
              success: true,
              message: 'File downloaded successfully',
              localPath: localPath
            });
          });
          writer.on('error', (err) => {
            reject({
              success: false,
              message: 'Failed to write file',
              error: err.message
            });
          });
        });
      } else {
        // Return stream if no local path specified
        return {
          success: true,
          message: 'File stream retrieved',
          stream: response.data
        };
      }
    } catch (error) {
      return this.handleError('Download', error);
    }
  }

  /**
   * List files in a directory
   * @param {string} remotePath - Remote directory path
   * @returns {Promise<Object>} List of files and directories
   */
  async listFiles(remotePath = '/') {
    if (this.isSaaS) {
      return this.listFilesSaaS(remotePath);
    } else {
      return this.listFilesOnPrem(remotePath);
    }
  }

  /**
   * List files for SaaS environment
   */
  async listFilesSaaS(remotePath = '/') {
    // Ensure we're logged in first
    await this.loginSaaS();

    try {
      const axiosInstance = this.getAxiosInstance();

      // Generate a random token (similar to the curl example)
      const randomToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      // Encode the path (double encoding like in the curl)
      const encodedPath = encodeURIComponent(remotePath);

      const response = await axiosInstance.post('/WebInterface/function/',
        `command=getXMLListing&format=JSONOBJ&path=${encodedPath}&random=${randomToken}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest'
          }
        }
      );

      console.log('\n🔍 LIST REQUEST (SaaS):');
      console.log('━'.repeat(60));
      console.log('URL:', `${this.baseUrl}/WebInterface/function/`);
      console.log('Command: getXMLListing');
      console.log('Format: JSONOBJ');
      console.log('Path:', remotePath);
      console.log('━'.repeat(60) + '\n');

      return {
        success: true,
        message: 'Files listed successfully (SaaS)',
        data: response.data
      };
    } catch (error) {
      return this.handleError('List (SaaS)', error);
    }
  }

  /**
   * List files for On-Premises environment
   */
  async listFilesOnPrem(remotePath = '/') {
    try {
      const axiosInstance = this.getAxiosInstance();

      const response = await axiosInstance.post('/api/list', {
        path: remotePath
      });

      console.log('\n🔍 LIST REQUEST (On-Premises):');
      console.log('━'.repeat(60));
      console.log('URL:', `${this.baseUrl}/api/list`);
      console.log('Path:', remotePath);
      console.log('━'.repeat(60) + '\n');

      return {
        success: true,
        message: 'Files listed successfully (On-Premises)',
        data: response.data
      };
    } catch (error) {
      return this.handleError('List (On-Premises)', error);
    }
  }

  /**
   * Create a folder on Active Transfer server
   * @param {string} folderPath - Path for the new folder
   * @returns {Promise<Object>} Response data
   */
  async createFolder(folderPath) {
    try {
      const axiosInstance = this.getAxiosInstance();

      const response = await axiosInstance.post('/api/createFolder', {
        path: folderPath
      });

      return {
        success: true,
        message: 'Folder created successfully',
        data: response.data
      };
    } catch (error) {
      return this.handleError('Create Folder', error);
    }
  }

  /**
   * Delete a file or folder
   * @param {string} remotePath - Path to delete
   * @returns {Promise<Object>} Response data
   */
  async delete(remotePath) {
    try {
      const axiosInstance = this.getAxiosInstance();

      const response = await axiosInstance.post('/api/delete', {
        path: remotePath
      });

      return {
        success: true,
        message: 'Deleted successfully',
        data: response.data
      };
    } catch (error) {
      return this.handleError('Delete', error);
    }
  }

  /**
   * Rename a file or folder
   * @param {string} oldPath - Current path
   * @param {string} newPath - New path/name
   * @returns {Promise<Object>} Response data
   */
  async rename(oldPath, newPath) {
    try {
      const axiosInstance = this.getAxiosInstance();

      const response = await axiosInstance.post('/api/rename', {
        oldPath: oldPath,
        newPath: newPath
      });

      return {
        success: true,
        message: 'Renamed successfully',
        data: response.data
      };
    } catch (error) {
      return this.handleError('Rename', error);
    }
  }

  /**
   * Check if path is a file
   * @param {string} remotePath - Path to check
   * @returns {Promise<Object>} Response data
   */
  async isFile(remotePath) {
    try {
      const axiosInstance = this.getAxiosInstance();

      const response = await axiosInstance.post('/api/isFile', {
        path: remotePath
      });

      return {
        success: true,
        message: 'Path verified',
        data: response.data
      };
    } catch (error) {
      return this.handleError('Verify', error);
    }
  }

  /**
   * Handle errors uniformly
   */
  handleError(operation, error, requestInfo = null) {
    console.error(`\n❌ ${operation} Error:`, error.message);

    if (requestInfo) {
      console.error('\n🔍 REQUEST THAT FAILED:');
      console.error('━'.repeat(60));
      console.error(JSON.stringify(requestInfo, null, 2));
      console.error('━'.repeat(60));
    }

    if (error.config) {
      console.error('\n📤 AXIOS REQUEST CONFIG:');
      console.error('━'.repeat(60));
      console.error('URL:', error.config.url);
      console.error('Method:', error.config.method?.toUpperCase());
      console.error('Headers:', JSON.stringify(error.config.headers, null, 2));
      if (error.config.data) {
        console.error('Data Type:', typeof error.config.data);
        if (typeof error.config.data === 'string') {
          console.error('Data:', error.config.data.substring(0, 500));
        }
      }
      console.error('━'.repeat(60));
    }

    if (error.response) {
      console.error('\n📥 SERVER RESPONSE:');
      console.error('━'.repeat(60));
      console.error('Status:', error.response.status, error.response.statusText);
      console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
      console.error('━'.repeat(60) + '\n');
    }

    return {
      success: false,
      operation: operation,
      message: error.response?.data?.message || error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      details: error.response?.data,
      requestInfo: requestInfo
    };
  }
}

export default ActiveTransferClient;
