import { registerCatalog } from "@/shared/lib/lingui";
import { messages as en } from "./locales/en";
import { messages as ja } from "./locales/ja";
import { messages as ko } from "./locales/ko";

registerCatalog({ ko, en, ja });
