# 摄像头功能快速参考

## 🎥 基本操作

### 拍照
1. **Start Camera** → 启动预览
2. **Capture** → 拍照
3. 照片自动保存到Gallery

### 录像
1. **Start Camera** → 启动预览
2. **Record** → 开始录像（保持预览可见）
3. **Stop Rec** → 停止录像
4. 等待2-3秒后视频出现在Gallery

### 查看媒体
- Gallery中点击图片/视频查看
- 视频支持播放控制
- 悬停显示"Convert to DICOM"按钮

## ✅ 正常工作的标志

### 摄像头预览
- ✅ 可以看到实时画面
- ✅ 画面流畅，无卡顿
- ✅ 设备列表显示摄像头名称

### 录像功能
- ✅ 录像时仍能看到预览
- ✅ 右上角显示红色"REC"指示器
- ✅ 停止后视频出现在Gallery
- ✅ 视频可以正常播放

### 文件加载
- ✅ 图片立即显示
- ✅ 视频显示播放控件
- ✅ 控制台无错误信息

## ⚠️ 常见问题快速修复

| 问题 | 快速解决 |
|------|---------|
| 摄像头无法启动 | 1. 检查权限<br>2. 关闭其他使用摄像头的应用<br>3. 重启应用 |
| 录像时看不到画面 | 正常！新版本已修复，应该能看到预览 |
| 视频无法播放 | 1. 等待2-3秒<br>2. 刷新页面<br>3. 检查控制台错误代码 |
| 设备列表为空 | 1. 检查ffmpeg是否安装<br>2. 检查设备连接<br>3. 使用Camera Test诊断 |

## 🔧 诊断工具

### Camera Test
**位置**: 患者详情页 → Imaging & Capture → Camera Test按钮

**测试项目**:
- ✅ Browser Camera Access - 浏览器摄像头访问
- ✅ Backend Device Detection - 后端设备检测
- ✅ Camera Preview - 实时预览
- ✅ Test Protocol Handler - 文件加载协议

### 控制台日志
**打开方式**: F12 → Console标签

**关键信息**:
```
✅ "Video can play" - 视频可播放
✅ "Video metadata loaded" - 元数据已加载
❌ "Failed to load video" - 加载失败
❌ "Video error code: X" - 错误代码
```

## 📊 视频规格

### 支持的格式
- **图片**: JPG, PNG, GIF, WebP
- **视频**: MP4 (H.264), AVI, MOV

### 录像设置
- **分辨率**: 1280x720 (默认)
- **编码**: H.264 (baseline profile)
- **最大时长**: 60秒
- **帧率**: 30fps

### 文件位置
```
~/Library/Application Support/simplelims-offline/captures/
```

## 🎯 最佳实践

### 拍照
- ✅ 确保光线充足
- ✅ 保持摄像头稳定
- ✅ 等待预览清晰后再拍照

### 录像
- ✅ 录像前先测试预览
- ✅ 避免录制超长视频（建议<30秒）
- ✅ 停止录像后等待文件写入完成
- ✅ 定期清理旧视频释放空间

### 故障排除
- ✅ 先使用Camera Test诊断
- ✅ 查看控制台日志
- ✅ 检查文件是否存在
- ✅ 必要时重启应用

## 📞 获取帮助

如果问题仍未解决，请提供：
1. 操作系统版本
2. 摄像头型号
3. Camera Test结果截图
4. 控制台错误日志
5. 后端日志（如果可用）

详细故障排除指南: `docs/CAMERA_TROUBLESHOOTING.md`
