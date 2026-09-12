import React from 'react';

import { Building, Globe, Users } from 'lucide-react';

import { Badge } from '@client/src/components/ui/badge';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@client/src/components/ui/hover-card';
import { ItemPill } from '@client/src/components/business-ui/entity-combobox/item-pill';
import { UserSelectTag } from '@client/src/components/business-ui/user-select/user-select-tag';
import { DepartmentSelectTag } from '@client/src/components/business-ui/department-select/department-select-tag';
import { ChatSelectTag } from '@client/src/components/business-ui/chat-select/chat-select-tag';
import type { Department as DepartmentValue } from '@client/src/components/business-ui/department-select/types';
import type { Chat } from '@client/src/components/business-ui/chat-select/types';
import type {
  ForceRoleDTO,
  UserSimpleDTO,
  DepartmentDTO,
  ChatSimpleDTO,
} from '@shared/api.interface';

interface RoleMemberSummaryProps {
  role: ForceRoleDTO;
}

const MAX_VISIBLE = 3;

const noopClose = (): void => {};

const SPECIAL_MEMBER_ICONS: Record<string, React.ReactNode> = {
  allEmployees: (
    <span
      className="flex items-center justify-center rounded-full bg-primary"
      style={{ width: 20, height: 20 }}
    >
      <Building className="h-3 w-3 text-primary-foreground" />
    </span>
  ),
  public: (
    <span
      className="flex items-center justify-center rounded-full bg-primary"
      style={{ width: 20, height: 20 }}
    >
      <Globe className="h-3 w-3 text-primary-foreground" />
    </span>
  ),
  appDeveloper: (
    <span
      className="flex items-center justify-center rounded-full bg-primary"
      style={{ width: 20, height: 20 }}
    >
      <Users className="h-3 w-3 text-primary-foreground" />
    </span>
  ),
};

const RoleMemberSummary: React.FC<RoleMemberSummaryProps> = ({ role }) => {
  const rm = role.roleMembers;
  const pills: React.ReactNode[] = [];

  if (rm?.allEmployees) {
    pills.push(
      <ItemPill
        key="allEmployees"
        label="企业全员"
        avatar={SPECIAL_MEMBER_ICONS.allEmployees}
        size="small"
      />,
    );
  }
  if (rm?.public) {
    pills.push(
      <ItemPill
        key="public"
        label="互联网公开"
        avatar={SPECIAL_MEMBER_ICONS.public}
        size="small"
      />,
    );
  }
  if (rm?.presetGroup?.isContainsAdmin) {
    pills.push(
      <ItemPill
        key="appDeveloper"
        label="应用开发者"
        avatar={SPECIAL_MEMBER_ICONS.appDeveloper}
        size="small"
      />,
    );
  }

  const users: UserSimpleDTO[] = rm?.userList ?? [];
  for (const u of users) {
    pills.push(
      <UserSelectTag
        key={`u-${u.userID ?? ''}`}
        userValue={{
          id: u.userID ?? '',
          name: u.name?.zh_cn ?? '',
          avatar: u.avatar,
        }}
        onClose={noopClose}
        disabled
        className="!opacity-100 !cursor-default"
        size="small"
      />,
    );
  }

  const depts: DepartmentDTO[] = rm?.departmentList ?? [];
  for (const d of depts) {
    pills.push(
      <DepartmentSelectTag
        key={`d-${d.id ?? ''}`}
        departmentValue={{
          id: d.id ?? '',
          name: d.name?.zh_cn ?? '',
        }}
        onClose={noopClose}
        disabled
        className="!opacity-100 !cursor-default"
        size="small"
      />,
    );
  }

  const chats: ChatSimpleDTO[] = rm?.groupChatList ?? [];
  for (const c of chats) {
    const chatValue: Chat = {
      id: c.chatID ?? '',
      name: c.name?.zh_cn ?? '',
      avatar: c.avatar || '#1456F0',
    };
    pills.push(
      <ChatSelectTag
        key={`c-${c.chatID ?? ''}`}
        chatValue={chatValue}
        onClose={noopClose}
        disabled
        className="!opacity-100 !cursor-default"
        size="small"
      />,
    );
  }

  if (pills.length === 0) {
    return <span className="text-muted-foreground">--</span>;
  }

  const visible = pills.slice(0, MAX_VISIBLE);
  const overflow = pills.slice(MAX_VISIBLE);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible}
      {overflow.length > 0 && (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Badge variant="secondary" className="cursor-pointer">
              +{overflow.length}
            </Badge>
          </HoverCardTrigger>
          <HoverCardContent className="w-auto max-w-sm">
            <div className="flex flex-wrap gap-1.5">{overflow}</div>
          </HoverCardContent>
        </HoverCard>
      )}
    </div>
  );
};

export default RoleMemberSummary;
