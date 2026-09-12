export type AccountType = 'user' | 'department' | 'chat' | 'apaas' | 'lark';

export interface UserInfo {
  userID: string;
  larkUserID?: string;
  employeeID?: string;
  miaodaUserID?: string;
  larkID?: string;
  name: string;
  nickname?: string;
  avatar?: string;
  mobile?: string;
  gender?: string;
  country?: string;
  workStation?: string;
  employeeNo?: string;
  city?: string;
  jobTitle?: string;
  employeeType?: string;
  leader?: any;
  dottedLineLeaders?: any[];
  userType?: string;
  department?: string;
  tenantName?: string;
  userId?: string;
  userName?: string;
  [key: string]: any;
}

export interface DepartmentInfo {
  departmentID: string;
  larkDepartmentID: string;
  name: any;
  departmentId?: string;
  departmentName?: string;
  [key: string]: any;
}

export interface ChatInfo {
  chatID: string;
  name: any;
  avatar?: string;
  chatId?: string;
  chatName?: string;
  [key: string]: any;
}

export interface SearchAvatar {
  userID: string;
  avatar: string;
  [key: string]: any;
}

export interface LeaderUser {
  userID: string;
  name: string;
  employeeID?: string;
  miaodaUserID?: string;
  [key: string]: any;
}

export interface UserProfileData {
  userID: string;
  name: string;
  avatar?: string;
  [key: string]: any;
}

export interface SearchUsersParams {
  query?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  [key: string]: any;
}

export interface SearchUsersResponse {
  data: UserInfo[];
  users?: UserInfo[];
  userList?: UserInfo[];
  result?: UserInfo[];
  userInfoMap?: Record<string, UserInfo>;
  total?: number;
  [key: string]: any;
}

export interface BatchGetUsersResponse {
  data: UserInfo[];
  users?: UserInfo[];
  userList?: UserInfo[];
  result?: UserInfo[];
  userInfoMap?: Record<string, UserInfo>;
  [key: string]: any;
}

export interface ConvertExternalContactResponse {
  data: any;
  userID?: string;
  [key: string]: any;
}

export interface SearchDepartmentsParams {
  query?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  [key: string]: any;
}

export interface SearchDepartmentsResponse {
  data: DepartmentInfo[];
  departments?: DepartmentInfo[];
  departmentList?: DepartmentInfo[];
  result?: DepartmentInfo[];
  total?: number;
  [key: string]: any;
}

export interface BatchGetDepartmentsResponse {
  data: DepartmentInfo[];
  departments?: DepartmentInfo[];
  departmentList?: DepartmentInfo[];
  result?: DepartmentInfo[];
  [key: string]: any;
}

export interface SearchChatsParams {
  query?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  [key: string]: any;
}

export interface SearchChatsResponse {
  data: ChatInfo[];
  chats?: ChatInfo[];
  chatList?: ChatInfo[];
  result?: ChatInfo[];
  total?: number;
  [key: string]: any;
}

export interface BatchGetChatsResponse {
  data: ChatInfo[];
  chats?: ChatInfo[];
  chatList?: ChatInfo[];
  result?: ChatInfo[];
  chatInfoMap?: Record<string, ChatInfo>;
  [key: string]: any;
}

export class UserService {
  async search(params: SearchUsersParams): Promise<SearchUsersResponse> {
    return { data: [{ userID: 'dev-user-001', name: '开发者' }] };
  }
  async searchUsers(params: SearchUsersParams): Promise<SearchUsersResponse> {
    return this.search(params);
  }
  async batchGet(ids: string[]): Promise<BatchGetUsersResponse> {
    return { data: ids.map(id => ({ userID: id, name: id })) };
  }
  async listUsersByIds(ids: string[]): Promise<BatchGetUsersResponse> {
    return this.batchGet(ids);
  }
  async convertExternalContact(id: string): Promise<ConvertExternalContactResponse> {
    return { data: { userID: id } };
  }
}

export class UserProfileService {
  async get(): Promise<UserProfileData> {
    return { userID: 'dev-user-001', name: '开发者' };
  }
  async getUserProfile(): Promise<UserProfileData> {
    return this.get();
  }
}

export class DepartmentService {
  async search(params: SearchDepartmentsParams): Promise<SearchDepartmentsResponse> {
    return { data: [] };
  }
  async searchDepartments(params: SearchDepartmentsParams): Promise<SearchDepartmentsResponse> {
    return this.search(params);
  }
  async batchGet(ids: string[]): Promise<BatchGetDepartmentsResponse> {
    return { data: [] };
  }
}

export class ChatService {
  async search(params: SearchChatsParams): Promise<SearchChatsResponse> {
    return { data: [] };
  }
  async searchChats(params: SearchChatsParams): Promise<SearchChatsResponse> {
    return this.search(params);
  }
  async batchGet(ids: string[]): Promise<BatchGetChatsResponse> {
    return { data: [] };
  }
  async listChatsByIds(ids: string[]): Promise<BatchGetChatsResponse> {
    return this.batchGet(ids);
  }
}

export function getAssetsUrl(path: string): string {
  return path;
}

export async function searchUsers(keyword: string): Promise<UserInfo[]> {
  return [{ userID: 'dev-user-001', name: '开发者' }];
}

export async function searchDepartments(keyword: string): Promise<DepartmentInfo[]> {
  return [];
}

export async function searchChats(keyword: string): Promise<ChatInfo[]> {
  return [];
}

export async function getUsersByIds(ids: string[]): Promise<UserInfo[]> {
  return ids.map(id => ({ userID: id, name: id }));
}

export async function getDepartmentsByIds(ids: string[]): Promise<DepartmentInfo[]> {
  return [];
}

export async function getChatsByIds(ids: string[]): Promise<ChatInfo[]> {
  return [];
}
