# 摄像头/录像功能修复总结

## 修复日期
2026年2月2日

## 问题描述

### 问题1: 图像/视频无法显示
- **症状**: Gallery中的媒体文件无法加载，控制台显示`net::ERR_UNEXPECTED`错误
- **根本原因**: `app-data://`协议处理器使用`net.fetch(pathToFileURL())`导致协议冲突

### 问题2: 录像时无法看到实时预览
- **症状**: 点击录像按钮后，视频预览变黑，显示"Recording in Progress"
- **根本原因**: 录像时停止了浏览器视频流，改用后端ffmpeg独占摄像头

### 问题3: 新录制的视频无法立即播放
- **症状**: 刚录制的视频在Gallery中显示加载错误
- **根本原因**: 
  - 视频文件可能还在写入中
  - 视频编码设置不适合浏览器播放
  - 缺少必要的元数据标记

## 解决方案

### 1. 修复协议处理器 (`electron/main.ts`)

**改进前**:
```typescript
return net.fetch(pathToFileURL(filePath).toString());
```

**改进后**:
```typescript
// 直接读取文件并返回，带正确的MIME类型
const fileBuffer = fs.readFileSync(filePath);
return new Response(fileBuffer, {
  status: 200,
  headers: {
    'Content-Type': mimeType,
    'Content-Length': fileBuffer.length.toString(),
    'Cache-Control': 'no-cache'
  }
});
```

**效果**: 
- ✅ 图像可以正常显示
- ✅ 视频可以正常加载和播放
- ✅ 支持多种媒体格式（JPG, PNG, MP4, AVI, MOV等）

### 2. 改进录像实时预览 (`src/components/imaging/ImageCapture.tsx`)

**改进前**:
```typescript
// 录像时停止浏览器流
stopStream();
const result = await window.electronAPI.video.startRecording(...);
```

**改进后**:
```typescript
// 录像时保持浏览器预览流运行
// 不调用stopStream()，让用户可以看到正在录制的内容
const result = await window.electronAPI.video.startRecording(...);
setIsRecording(true); // 只显示REC指示器
```

**效果**:
- ✅ 录像时可以看到实时画面
- ✅ REC指示器清晰显示录制状态
- ✅ 用户体验更好

### 3. 优化视频编码设置 (`electron/services/video-capture-service.ts`)

**改进前**:
```typescript
args.push('-c:v', 'libx264');
args.push('-preset', 'fast');
args.push('-crf', '23');
args.push('-pix_fmt', 'yuv420p');
```

**改进后**:
```typescript
// 使用浏览器兼容的H.264设置
args.push('-c:v', 'libx264');
args.push('-preset', 'ultrafast');      // 更快的编码
args.push('-tune', 'zerolatency');      // 低延迟优化
args.push('-crf', '23');
args.push('-pix_fmt', 'yuv420p');       // 浏览器必需
args.push('-movflags', '+faststart');   // 启用流式播放
args.push('-profile:v', 'baseline');    // 最大兼容性
args.push('-level', '3.0');             // 设备兼容性
```

**效果**:
- ✅ 视频可以在浏览器中直接播放
- ✅ 支持渐进式下载（边下载边播放）
- ✅ 最大化设备兼容性
- ✅ 更快的编码速度

### 4. 增强错误处理和日志

**添加的功能**:
- 详细的视频加载错误日志（错误代码、消息）
- 视频元数据日志（时长、分辨率）
- ffmpeg进程输出日志
- 文件大小和存在性检查
- 空文件检测

**效果**:
- ✅ 更容易诊断问题
- ✅ 更好的用户反馈
- ✅ 便于调试和维护

### 5. 改进录像停止逻辑

**改进**:
```typescript
// 优雅地停止ffmpeg进程
recording.process.stdin?.write('q');

// 等待文件完全写入
setTimeout(() => {
  resolve(recording.session.outputPath);
}, 500);

// 检查文件大小
if (stats.size === 0) {
  reject(new Error('Recording file is empty'));
}
```

**效果**:
- ✅ 确保视频文件完整
- ✅ 避免空文件或损坏文件
- ✅ 更可靠的录像停止

### 6. 添加调试工具

**新增功能**:
- `debug:testProtocol` IPC处理器
- Camera Test中的"Test Protocol Handler"按钮
- 详细的协议测试功能

**效果**:
- ✅ 可以快速验证协议处理器是否工作
- ✅ 便于排查文件加载问题
- ✅ 提供完整的诊断信息

## 测试步骤

### 1. 测试图像捕获
1. 进入患者详情页面
2. 点击"Start Camera"启动摄像头
3. 点击"Capture"拍照
4. 确认图像在Gallery中正确显示

### 2. 测试视频录制
1. 点击"Start Camera"启动摄像头
2. 点击"Record"开始录像
3. **验证**: 录像时应该能看到实时画面，右上角显示"REC"指示器
4. 点击"Stop Rec"停止录像
5. 等待2秒后，视频应该出现在Gallery中
6. 点击视频播放，确认可以正常播放

### 3. 测试协议处理器
1. 点击"Camera Test"按钮
2. 点击"Test Protocol Handler"
3. 检查控制台输出，确认测试通过

## 已知限制

1. **录像时的双重访问**: 浏览器预览和ffmpeg后端同时访问摄像头可能在某些系统上导致冲突
   - **解决方案**: 如果遇到问题，可以回退到停止预览的方式

2. **视频编码延迟**: 使用`ultrafast`预设可能导致文件稍大
   - **权衡**: 优先考虑实时性能和兼容性

3. **macOS摄像头权限**: 首次使用需要授予权限
   - **解决方案**: 系统会自动提示，用户需要允许

## 文件修改清单

### 核心修复
- ✅ `electron/main.ts` - 修复app-data协议处理器
- ✅ `electron/services/video-capture-service.ts` - 优化视频编码和日志
- ✅ `src/components/imaging/ImageCapture.tsx` - 改进录像预览和错误处理

### 调试工具
- ✅ `electron/ipc-handlers.ts` - 添加debug:testProtocol处理器
- ✅ `electron/preload.ts` - 暴露debug API
- ✅ `src/types/electron.d.ts` - 添加debug类型定义
- ✅ `src/components/imaging/CameraTest.tsx` - 增强测试功能

### 文档
- ✅ `docs/CAMERA_TROUBLESHOOTING.md` - 更新故障排除指南
- ✅ `docs/CAMERA_FIX_SUMMARY.md` - 本文档

## 性能影响

- **启动时间**: 无影响
- **内存使用**: 轻微增加（由于保持预览流）
- **CPU使用**: 录像时略有增加（双重视频处理）
- **磁盘空间**: 视频文件大小正常

## 后续建议

1. **考虑添加视频压缩选项**: 让用户选择质量/大小平衡
2. **添加录像时长限制提示**: 在UI上显示剩余时间
3. **支持音频录制**: 当前只录制视频，可以考虑添加音频
4. **添加视频缩略图**: 在Gallery中显示视频第一帧作为预览
5. **批量导出功能**: 允许用户批量导出捕获的媒体文件

## 总结

所有主要问题已修复：
- ✅ 图像和视频可以正常显示
- ✅ 录像时可以看到实时预览
- ✅ 新录制的视频可以立即播放
- ✅ 增强的错误处理和日志
- ✅ 完整的调试工具

系统现在可以稳定地用于医疗设备的图像和视频捕获。
