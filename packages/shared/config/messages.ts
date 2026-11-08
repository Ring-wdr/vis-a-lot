// 패키지(@vis-a-lot/shared)의 문구 카탈로그(config/locales/*.ts)를 등록한다. 매크로를 쓰는 패키지 파일이 이 파일을 import한다.
// 카탈로그는 패키지가 갖고(lingui.config.ts), 두 앱은 이 모듈을 거쳐 같은 번역을 쓴다.
import { registerCatalog } from "../lib/lingui";
import { messages as en } from "./locales/en";
import { messages as ja } from "./locales/ja";
import { messages as ko } from "./locales/ko";

registerCatalog({ ko, en, ja });
