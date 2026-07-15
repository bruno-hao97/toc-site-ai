import { buildDeviceInfo } from './audioVoices';
import { GOMMO_CHAT_CONFIG } from './gommoChatConfig';

export function gommoDeviceFields(): Record<string, string> {
  return {
    device_id: GOMMO_CHAT_CONFIG.deviceId,
    device_name: GOMMO_CHAT_CONFIG.deviceName,
    device_info: buildDeviceInfo('vi'),
  };
}
