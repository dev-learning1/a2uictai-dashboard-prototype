import { ElicitData, RadarUsbData, RadarWifiData, TubeTrailerData } from "@/components/Wss";

export interface ModifyElicitData {
    topic_id: string;
    data: {
      date: string;
      rssi: string;
      address: string;
      battery: string;
      event: string;
      event_type: string;
    };
  }

export interface GroupedDeviceData extends Omit<ModifyElicitData, 'data'>, Omit<RadarWifiData, 'data'> {
    router_id: string;
    device_id: string;
    data: ModifyElicitData['data'] | RadarWifiData['data']; // 두 가지 타입을 모두 허용
}

export interface GroupedElicitData extends ModifyElicitData {
    router_id: string;
    device_id: string;
}

export interface GroupedRadarWifiData extends RadarWifiData {
    router_id: string;
    device_id: string;
}

export const deviceData = (mqttDataDb: (ElicitData | RadarUsbData | RadarWifiData | TubeTrailerData)[]):GroupedDeviceData[] => {
    const groupedData:GroupedDeviceData[] = [];
    
    mqttDataDb
    .filter((data): data is (ElicitData | RadarWifiData) => {
        // ElicitData 또는 RadarUsbData만 필터링
        return 'data' in data && ('BR' in data.data || 'cuid' in data.data) === false; 
    })
    .forEach(data => {
        if (data.topic_id.includes('ALIVE') || data.topic_id.includes('JOINCNF')) return;
    
        const [router_id, device_id] = data.topic_id.split('/');
        if ('elementType' in data.data) {
            // ElicitData인 경우 무조건 push
            const modifiedData:ModifyElicitData = {
                ...data,
                data: {
                  ...data.data,
                  event_type: data.data.elementType, // elementType을 event_type으로 대체
                },
            };
            groupedData.push({ ...modifiedData, router_id, device_id });
          } else if (device_id.includes('room3') || device_id.includes('Test')) {
            const radarData: GroupedDeviceData = {
                ...data,
                router_id,
                device_id,
                data: data.data as RadarWifiData['data'] // RadarWifiData 타입으로 명시적 단언
              };
              groupedData.push(radarData);
          }
      });

      return groupedData;
}

export const doorData = (mqttDataDb: (ElicitData | RadarUsbData | RadarWifiData | TubeTrailerData)[]):GroupedElicitData[] => {
    const groupedData:GroupedElicitData[] = [];
    
    mqttDataDb.filter((data): data is ElicitData => 'address' in data.data && data.data.address !== undefined && data.data.address.includes('DOOR'))
    .forEach(data => {
        if (data.topic_id.includes('ALIVE') || data.topic_id.includes('JOINCNF')) return;
    
        const [router_id, device_id] = data.topic_id.split('/');
        const modifiedData:ModifyElicitData = {
            ...data,
            data: {
              ...data.data,
              event_type: data.data.elementType, // elementType을 event_type으로 대체
            },
        };
        groupedData.push({ ...modifiedData, router_id, device_id });
      });

      return groupedData;
}

export const buttonData = (mqttDataDb: (ElicitData | RadarUsbData | RadarWifiData | TubeTrailerData)[]):GroupedElicitData[] => {
    const groupedData:GroupedElicitData[] = [];
    mqttDataDb.filter((data): data is ElicitData => 'address' in data.data && data.data.address !== undefined && data.data.address.includes('BTN'))
    .forEach(data => {
        if (data.topic_id.includes('ALIVE') || data.topic_id.includes('JOINCNF')) return;
    
        const [router_id, device_id] = data.topic_id.split('/');
        const modifiedData:ModifyElicitData = {
            ...data,
            data: {
              ...data.data,
              event_type: data.data.elementType, // elementType을 event_type으로 대체
            },
        };
        groupedData.push({ ...modifiedData, router_id, device_id });
      });

      return groupedData;
}

export const radarWifiData = (mqttDataDb: (ElicitData | RadarUsbData | RadarWifiData | TubeTrailerData)[]):GroupedRadarWifiData[] => {
    const groupedData:GroupedRadarWifiData[] = [];
    
    mqttDataDb.filter((data): data is RadarWifiData => 'heart' in data.data)
    .forEach(data => {
        if (data.topic_id.includes('ALIVE') || data.topic_id.includes('JOINCNF')) return;
    
        const [router_id, device_id] = data.topic_id.split('/');
        // if (device_id.includes('room3')){// || device_id.includes('Test')) {
            // RadarWifiData인 경우 device_id가 'room'을 포함하면 push
            groupedData.push({ ...data, router_id, device_id });
          // }
      });

    return groupedData;
}