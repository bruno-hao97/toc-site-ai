/** Device fields tối thiểu cho Gommo API từ server (Railway). */
export function gommoServerDeviceFields(): Record<string, string> {
  const deviceId = 'site-ai-server-railway';
  const deviceInfo = JSON.stringify({
    device_id: deviceId,
    device_name: 'Site AI Server',
    device_type: 'server',
    platform: 'linux',
    app_mode: 'api',
  });
  return {
    device_id: deviceId,
    device_name: 'Site AI Server',
    device_info: deviceInfo,
  };
}
