// shared의 문구 카탈로그(config/locales/*.ts)를 등록한다. 카탈로그를 쓰는 파일(time.ts 등)이 이 파일을 import한다.
import { registerCatalog } from "@/shared/lib/lingui";
import { messages as en } from "./locales/en";
import { messages as ko } from "./locales/ko";

registerCatalog({ ko, en });
