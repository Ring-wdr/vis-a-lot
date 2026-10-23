// 피드 scheduler API. 프로토타입에 백그라운드 서버가 없어 화면이 앱 시작 시와 1분 간격으로 부른다.

import { feedClient, unwrap } from "./client";

export const schedulerApi = {
  run: () => unwrap(feedClient.POST("/scheduler/run")),
};
