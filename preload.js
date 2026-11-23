const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pms', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  login: (account, pwd) => ipcRenderer.invoke('login', { account, pwd }),
  validateToken: () => ipcRenderer.invoke('validate-token'),
  getDeclarationList: (params) => ipcRenderer.invoke('get-declaration-list', params),
  getPrepareData: () => ipcRenderer.invoke('get-prepare-data'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  uploadFile: (filePath, uploadName) => ipcRenderer.invoke('upload-file', { filePath, uploadName }),
  createDeclaration: (declarations) => ipcRenderer.invoke('create-declaration', declarations),
  cancelDeclaration: (params) => ipcRenderer.invoke('cancel-declaration', params),
  deleteDeclaration: (params) => ipcRenderer.invoke('delete-declaration', params),
  getOvertimeApplications: (params) => ipcRenderer.invoke('get-overtime-applications', params),
  getLeaveApplications: (params) => ipcRenderer.invoke('get-leave-applications', params),
  getAttendanceResults: (params) => ipcRenderer.invoke('get-attendance-results', params),
  // 项目目录 & 代码文件
  selectProjectDir: () => ipcRenderer.invoke('select-project-dir'),
  scanModules: () => ipcRenderer.invoke('scan-modules'),
  generateCodeZip: (params) => ipcRenderer.invoke('generate-code-zip', params),
  generateRemarks: (params) => ipcRenderer.invoke('generate-remarks', params),
});
