// 피드 서비스 API 정의. 모듈마다 modules/<모듈>/routes.ts에 두고 여기서 모은다 (OAS 생성과 gateway가 이 목록을 쓴다).
// route 이름은 서비스 전체에서 겹치지 않게 모듈 이름을 붙인다 (listPosts, getUser …).

export * from "./modules/comments/routes";
export * from "./modules/groups/routes";
export * from "./modules/imports/routes";
export * from "./modules/notifications/routes";
export * from "./modules/posts/routes";
export * from "./modules/reports/routes";
export * from "./modules/scheduler/routes";
export * from "./modules/search/routes";
export * from "./modules/seed/routes";
export * from "./modules/system/routes";
export * from "./modules/users/routes";
export * from "./modules/views/routes";
