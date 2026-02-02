# 摄像头功能故障排除指南

## 问题诊断

### 1. 摄像头无法启动
**症状**: 界面显示"Camera Inactive"，点击"Start Camera"无反应

**可能原因**:
- 摄像头权限被拒绝
- 摄像头被其他应用占用
- 摄像头驱动问题
- ffmpeg未安装或路径不正确

**解决方案**:
1. 检查系统摄像头权限设置
2. 关闭其他可能使用摄像头的应用程序
3. 重启应用程序
4. 使用"Camera Test"功能进行诊断

### 2. 后端设备检测失败
**症状**: Backend Device Detection显示0个设备

**可能原因**:
- ffmpeg未安装
- 设备驱动问题
- 权限不足

**解决方案**:
1. 安装ffmpeg: 
   - macOS: `brew install ffmpeg`
   - Windows: 下载并添加到PATH
   - Linux: `sudo apt install ffmpeg`
2. 检查设备连接
3. 以管理员权限运行应用

### 3. 拍照/录像失败
**症状**: 点击Capture或Record按钮后出现错误

**可能原因**:
- 设备冲突（浏览器和后端同时访问）
- 存储权限问题
- ffmpeg配置错误

**解决方案**:
1. 确保只有一个进程访问摄像头
2. 检查应用数据目录权限
3. 查看控制台错误日志

### 4. 图像/视频无法显示 (已修复)
**症状**: Gallery中的媒体文件显示为黑色或加载失败，控制台显示`net::ERR_UNEXPECTED`错误

**原因**: 
- 自定义`app-data://`协议处理器实现问题
- 使用`net.fetch(pathToFileURL())`导致协议冲突

**解决方案** (已在最新版本中修复):
1. 改进了协议处理器，直接读取文件并返回正确的MIME类型
2. 添加了适当的HTTP头信息（Content-Type, Content-Length, Cache-Control）
3. 增强了错误处理和日志记录

**验证修复**:
1. 使用Camera Test中的"Test Protocol Handler"按钮
2. 检查控制台是否有详细的加载日志
3. 确认图像和视频能正常显示在Gallery中

## 调试步骤

### 1. 使用Camera Test功能
1. 进入任意患者详情页面
2. 滚动到"Imaging & Capture"部分
3. 点击"Camera Test"按钮
4. 查看各项测试结果：
   - Browser Camera Access: 检查浏览器是否能访问摄像头
   - Backend Device Detection: 检查后端是否能检测到设备
   - Camera Preview: 测试实时预览功能
5. 点击"Test Protocol Handler"验证文件加载功能

### 2. 测试完整录像流程
1. 点击"Start Camera"启动摄像头预览
2. 确认可以看到实时画面
3. 点击"Record"开始录像
4. **重要**: 录像时应该仍能看到实时画面，右上角显示红色"REC"指示器
5. 点击"Stop Rec"停止录像
6. 等待2-3秒让文件完全写入
7. 检查Gallery中是否出现新视频
8. 点击视频播放按钮，确认可以正常播放

### 3. 检查控制台日志
1. 打开开发者工具 (F12)
2. 查看Console标签页
3. 寻找相关信息：
   - "Video loading started" - 视频开始加载
   - "Video can play" - 视频可以播放
   - "Video metadata loaded" - 视频元数据（时长、分辨率）
   - 任何错误消息

### 4. 检查后端日志
查看Electron主进程的控制台输出，寻找以下信息：
- "ffmpeg detected and available for video capture."
- 设备列表信息
- "Recording process exited with code 0" - 录像成功完成
- "File size: XXX bytes" - 文件大小信息
- 错误消息

## 常见错误代码

### 视频错误代码
浏览器视频元素的error.code值：
- **1 (MEDIA_ERR_ABORTED)**: 用户中止了视频加载
- **2 (MEDIA_ERR_NETWORK)**: 网络错误，无法加载视频
- **3 (MEDIA_ERR_DECODE)**: 视频解码失败，可能是编码格式问题
- **4 (MEDIA_ERR_SRC_NOT_SUPPORTED)**: 视频格式不支持

### 摄像头错误
### NotAllowedError
- **含义**: 摄像头权限被拒绝
- **解决**: 在浏览器/系统设置中允许摄像头访问

### NotFoundError
- **含义**: 未找到摄像头设备
- **解决**: 检查设备连接，安装驱动程序

### NotReadableError
- **含义**: 摄像头被其他应用占用
- **解决**: 关闭其他使用摄像头的应用

### AbortError
- **含义**: 操作被中断
- **解决**: 重试操作

## 系统要求

### 支持的操作系统
- macOS 10.14+
- Windows 10+
- Linux (Ubuntu 18.04+)

### 依赖软件
- ffmpeg (用于后端视频处理)
- 摄像头驱动程序

### 支持的设备类型
- USB摄像头
- 内置摄像头
- USB视频采集卡
- 虚拟摄像头设备

## 联系支持

如果以上步骤无法解决问题，请提供以下信息：
1. 操作系统版本
2. 摄像头型号
3. 错误日志
4. Camera Test的测试结果