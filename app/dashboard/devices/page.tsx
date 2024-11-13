"use client"

import { SiteData } from '@/app/service/site';
import Site from '@/components/map/Site';
import Radio from '@/components/radio/RadioBox';
import { SelectedProvider } from '@/components/radio/RadioContext';
import WrappedRadio from '@/components/radio/WrappedRadio';
// import { SearchBar } from '@/components/searchbar/SearchBar';
import { SearchBar } from '@/components/searchbar/SearchBar';
import SkeletonLoader from '@/components/SkeletonLoader';
import { lusitana } from '@/public/fonts/fonts';
// import { getRouters } from '@/app/lib/actions';
// import { RevenueChartSkeleton } from '@/app/ui/skeletons';
import dynamic from 'next/dynamic';
// import { Router } from 'next/router';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { AgrData, ElicitData, RadarUsbData, RadarWifiData, Wss, AlertData, TubeTrailerData } from '@/components/Wss';
import { buttonData, deviceData, doorData, GroupedDeviceData, GroupedElicitData, GroupedRadarWifiData, ModifyElicitData, radarWifiData } from '@/app/service/Devices';
import OptionModal from '@/app/ui/devices/OptionModal';
import { SearchProvider, useSearch } from '@/components/searchbar/SearchContext';
import { useDisclosure } from '@chakra-ui/react';
import NotSearched from '@/components/searchbar/NotSearched';

const useDeviceUpdate = (latestMqttData: ElicitData | RadarUsbData | RadarWifiData | TubeTrailerData | null
): { [key: string]: { mqtt: boolean; timestamp: string; type: string } } => {
  const [highlightedRouters, setHighlightedRouters] = useState<{
    [key: string]: { agr: boolean; mqtt: boolean; timestamp: string; type: string }
  }>({});
  const timeouts = useRef<{ [key: string]: NodeJS.Timeout }>({});

  const updateHighlight = (topicId: string, type: 'agr' | 'mqtt') => {
    const timestamp = new Date().toLocaleTimeString();

    if (timeouts.current[topicId]) clearTimeout(timeouts.current[topicId]);

    setHighlightedRouters(prev => ({
      ...prev,
      [topicId]: { ...prev[topicId], [type]: true, timestamp, type }
    }));

    const timeout = setTimeout(() => {
      setHighlightedRouters(prev => ({
        ...prev,
        [topicId]: { ...prev[topicId], [type]: false }
      }));
      delete timeouts.current[topicId];
    }, 100);

    timeouts.current[topicId] = timeout;
  };

  // useEffect(() => {
  //   if (latestAgrData) {
  //     const routerId = latestAgrData.data.router_id;
  //     updateHighlight(routerId, 'agr');
  //   }
  // }, [latestAgrData]);

  useEffect(() => {
    if (latestMqttData) {
      const [router_id, device_id] = latestMqttData.topic_id.split('/');
      // let device_id_number = device_id;

      // if (device_id.includes('=')) {
      //   device_id_number = device_id.split('=')[1];
      // }

      updateHighlight(latestMqttData.topic_id, 'mqtt');
    }
  }, [latestMqttData]);

  return highlightedRouters;
};

export default function Page(){
  const { searchTerm, setSearchTerm } = useSearch();

  const deviceOptions = ['도어', '버튼', '레이더'];
  const optionsHeader = {
    first: '장소',
    second: '게이트웨이',
    third: '디바이스',
  };

  const { isConnected, agrDataDb, mqttDataDb, latestAgrData, latestMqttData, alertDataDb } = useContext(Wss);

  const [modalState, setModalState] = useState({
    first: { isOpen: false, leftOption: '장소', rightOption: '전체'},//headerText: '장소·전체' },
    second: { isOpen: false, leftOption: '게이트웨이', rightOption: '전체'},//headerText: '게이트웨이·전체' },
    third: { isOpen: false, leftOption: '디바이스', rightOption: '전체'}//headerText: '디바이스·전체' },
  });
  // const [selectedLeftOption, setSelectedLeftOption] = useState('');
  // const [selectedRightOption, setSelectedRightOption] = useState('');

  const toggleModal = (modal:'first' | 'second' | 'third') => {
    setModalState((prev) => ({
      ...prev,
      [modal]: { ...prev[modal], isOpen: !prev[modal].isOpen },
    }));
  };

  const setModalOptions = (modal: 'first' | 'second' | 'third', leftOption?: string, rightOption?: string) => {
    setModalState((prev) => ({
      ...prev,
      [modal]: {
        ...prev[modal],
        ...( { leftOption: leftOption ?? optionsHeader[modal] }),
        ...( { rightOption: rightOption ?? "전체" }), // rightOption이 있는 경우에만 추가
      },
    }));
  };

  const applyModal = (modal: 'first' | 'second' | 'third') => {
    setModalState((prev) => ({
      ...prev,
      [modal]: { ...prev[modal], isOpen: false },
    }));
  };
  
  // 도어, 버튼, 레이더 데이터 추출
  // const deviceDb = deviceData(mqttDataDb);
  const doorDb = doorData(mqttDataDb);
  const buttonDb = buttonData(mqttDataDb);
  const [radarWifiDb, setRadarWifiDb] = useState<GroupedRadarWifiData[]>([]);
  const [prevDataLength, setPrevDataLength] = useState(0);
  useEffect(() => {
    const radarDb = radarWifiData(mqttDataDb);
    console.log(radarDb.length > 0);
    // 데이터 길이가 변화할 때만 처리
    if (radarDb.length > 0 && radarDb.length !== prevDataLength) {
      setPrevDataLength(radarDb.length);
      console.log("Sorting data after delay");

      const sortedData = radarDb.sort((a, b) => {
        // 'room'이 포함된 device_id는 우선순위를 높게 (앞쪽에)
        const isRoomA = a.device_id.includes('room');
        const isRoomB = b.device_id.includes('room');

        if (isRoomA && !isRoomB) return -1; // a는 room 포함, b는 포함 안함 -> a가 앞
        if (!isRoomA && isRoomB) return 1; // a는 포함 안함, b는 포함 -> b가 앞

        // room이 둘 다 있거나 둘 다 없을 경우, 숫자 기준으로 정렬
        const deviceIdA = a.device_id.replace(/\D/g, ''); // 숫자만 남김
        const deviceIdB = b.device_id.replace(/\D/g, '');

        return parseInt(deviceIdA, 10) - parseInt(deviceIdB, 10); // 숫자 기준 정렬
      });

      setRadarWifiDb(sortedData);
    }
    
  }, [mqttDataDb.length]);
  
  const deviceDb = [...doorDb, ...buttonDb, ...radarWifiDb];

  const devicesUpdateTime = useDeviceUpdate(latestMqttData);

//   const RadarInterface = memo(({ radar }: { radar: GroupedRadarWifiData }) => {
//   const timestamp = devicesUpdateTime[`${radar.router_id}/${radar.device_id}`]?.timestamp;

//   return (
//     <div className="mb-4 deviceData" style={{ border: "2px solid black" }}>
//       <div className="border-b-4 mb-4">
//         <span className="mr-16">게이트웨이 MAC주소: {radar.router_id}</span>
//         <span className="mr-16">장치: 레이더_와이파이({radar.data.uid})</span>
//         <span>
//           일시: {timestamp && <span className="text-sm text-blue-500">(device update at {timestamp})</span>}
//         </span>
//       </div>
//       <div>
//         <span className="mr-8">Det: {radar.data.presence}</span>
//         <span className="mr-8">cnt: {radar.data.detect_count}</span>
//         <span className="mr-8">HR: {radar.data.heart}</span>
//         <span className="mr-8">BR: {radar.data.breath}</span>
//         <span className="mr-8">Dis: {radar.data.range}</span>
//         <span className="mr-8">fall: {radar.data.fall}</span>
//         <span className="mr-8">rssi: {radar.data.radar_rssi}</span>
//         <span className="mr-8">IP: {radar.data.device_ip}</span>
//         <span className="mr-8">MAC: {radar.data.mac_address}</span>
//       </div>
//     </div>
//   );
// }, (prevProps, nextProps) => prevProps.radar === nextProps.radar);

// const DoorInterface = memo(({ door }: { door: GroupedElicitData }) => {
//   const timestamp = devicesUpdateTime[door.device_id]?.timestamp;

//   return (
//     <div className="mb-4 deviceData" style={{ border: "2px solid black" }}>
//       <div className="border-b-4 mb-4">
//         <span className="mr-16">게이트웨이 MAC주소: {door.router_id}</span>
//         <span className="mr-16">장치: 도어({door.data.address})</span>
//         <span>일시: {new Date(door.data.date).toISOString().slice(0, 19).replace("T", " ")}</span>
//       </div>
//       <div>
//         <span className="mr-8">event: {door.data.event}</span>
//         <span className="mr-8">battery: {door.data.battery}</span>
//         <span className="mr-8">rssi: {door.data.rssi}</span>
//       </div>
//     </div>
//   );
// }, (prevProps, nextProps) => prevProps.door === nextProps.door);

// const ButtonInterface = memo(({ button }: { button: GroupedElicitData }) => {
//   const timestamp = devicesUpdateTime[button.device_id]?.timestamp;

//   return (
//     <div className="mb-4 deviceData" style={{ border: "2px solid black" }}>
//       <div className="border-b-4 mb-4">
//         <span className="mr-16">게이트웨이 MAC주소: {button.router_id}</span>
//         <span className="mr-16">장치: 버튼({button.data.address})</span>
//         <span>일시: {new Date(button.data.date).toISOString().slice(0, 19).replace("T", " ")}</span>
//       </div>
//       <div>
//         <span className="mr-8">event: {button.data.event}</span>
//         <span className="mr-8">battery: {button.data.battery}</span>
//         <span className="mr-8">rssi: {button.data.rssi}</span>
//       </div>
//     </div>
//   );
// }, (prevProps, nextProps) => prevProps.button === nextProps.button);


  useEffect(() => {
    setSearchTerm(''); 
  }, []);

  const filteredDevicesBySearch = searchTerm ? deviceDb.filter(device => {
    const routerId = device.router_id.includes(searchTerm);
    let deviceId = false;
    // return routerId || deviceId;
    if ('data' in device) {
      if ('address' in device.data) {
        // ElicitData 타입일 경우
        deviceId = device.data.address.toLowerCase().includes(searchTerm.toLowerCase());
      } else if ('uid' in device.data) {
        // RadarWifiData 타입일 경우
        deviceId = device.data.uid.toLowerCase().includes(searchTerm.toLowerCase());
      }
    }
    return routerId || deviceId;
  }) : [];
  
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    isOpen: isOpenSearchError,
    onOpen: openSearchError,
    onClose: closeSearchError
  } = useDisclosure();

  const displayDeviceDb = filteredDevicesBySearch.length > 0 ? filteredDevicesBySearch : deviceDb;

  useEffect(() => {
    if(searchTerm != '' ){
        if(filteredDevicesBySearch.length == 0 ){
            setErrorMessage("검색된 장비가 없습니다.");
            openSearchError();
            setSearchTerm('');
        }
    } 
  }, [searchTerm]);


  return (
      <main>
          <h1 className={`${lusitana.className} mb-4 text-xl md:text-2xl`}>
              장치관리
          </h1>
          <NotSearched isOpen={isOpenSearchError} onClose={closeSearchError} errorMessage={errorMessage} />
          <div className='mb-4'>
            <SearchBar maxWidth='600px' placeholder="장치를 검색하세요." me="10px"  border='3px solid black'/>
          </div>


          <div className='mb-4'>
            {/* <section className={`${styles.flexSection}`}>
              <OptionModal
                modalState={modalState.first}
                toggleModal={() => toggleModal('first')}
                leftOptions={['장소', '요양병원']}
                rightOptions={['전체', '영남요양병원']}
                setSelectedLeftOption={(option) =>
                  setModalOptions('first', option, modalState.first.rightOption)
                }
                setSelectedRightOption={(option) =>
                  setModalOptions('first', modalState.first.leftOption, option)
                }
                onApply={() => applyModal('first')}
              />

              <OptionModal
                modalState={modalState.second}
                toggleModal={() => toggleModal('second')}
                leftOptions={['게이트웨이']}
                rightOptions={['전체', ...routerID]}
                setSelectedLeftOption={(option) =>
                  setModalOptions('second', option, modalState.second.rightOption)
                }
                setSelectedRightOption={(option) =>
                  setModalOptions('second', modalState.second.leftOption, option)
                }
                onApply={() => applyModal('second')}
              />

              <OptionModal
                modalState={modalState.third}
                toggleModal={() => toggleModal('third')}
                leftOptions={['디바이스']}
                rightOptions={['전체', ...deviceOptions]}
                setSelectedLeftOption={(option) =>
                  setModalOptions('third', option, modalState.third.rightOption)
                }
                setSelectedRightOption={(option) =>
                  setModalOptions('third', modalState.third.leftOption, option)
                }
                onApply={() => applyModal('third')}
              />
            </section> */}
          </div>

          {displayDeviceDb
  .map((device, index) => {
    const timestamp = devicesUpdateTime[`${device.router_id}/${device.device_id}`]?.timestamp;
    const isModifyElicitData = (data: ModifyElicitData['data'] | RadarWifiData['data']): data is ModifyElicitData['data'] => {
      return 'date' in data && 'rssi' in data && 'address' in data;
  };

  if (isModifyElicitData(device.data)) {
    return(
      <div className="mb-4 deviceData" style={{ border: "2px solid black" }} key={index}>
      <div className="border-b-4 mb-4">
        <span className="mr-16">게이트웨이 MAC주소: {device.router_id}</span>
        <span className="mr-16">장치: {device.data.event_type === '3' ? '도어' : '버튼'}({device.data.address})</span>
        <span>일시: {new Date(device.data.date).toISOString().slice(0, 19).replace("T", " ")}</span>
      </div>
      <div>
        <span className="mr-8">event: {device.data.event}</span>
        <span className="mr-8">battery: {device.data.battery}</span>
        <span className="mr-8">rssi: {device.data.rssi}</span>
      </div>
    </div>
    )
  } else {
      return (
        <div className="mb-4 deviceData" key={index} style={{ border: "2px solid black" }}>
          <div className="border-b-4 mb-4">
            <span className="mr-16">게이트웨이 MAC주소: {device.router_id}</span>
            <span className="mr-16">장치: 레이더_와이파이({device.data.uid})</span>
            <span>
              일시: {timestamp && <span className="text-sm text-blue-500">(device update at {timestamp})</span>}
            </span>
          </div>
          <div>
            <span className="mr-8">Det: {device.data.presence}</span>
            <span className="mr-8">cnt: {device.data.detect_count}</span>
            <span className="mr-8">HR: {device.data.heart}</span>
            <span className="mr-8">BR: {device.data.breath}</span>
            <span className="mr-8">Dis: {device.data.range}</span>
            <span className="mr-8">fall: {device.data.fall}</span>
            <span className="mr-8">rssi: {device.data.radar_rssi}</span>
            <span className="mr-8">IP: {device.data.device_ip}</span>
            <span className="mr-8">MAC: {device.data.mac_address}</span>
          </div>
        </div>
      );
    }
  })
  }
      </main>
  );
}