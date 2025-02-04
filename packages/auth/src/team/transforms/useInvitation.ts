﻿import { InvitationState } from '@/invitation'
import { Transform } from '@/team/types'

export const useInvitation =
  (id: string): Transform =>
  state => {
    const invitations = { ...state.invitations }
    const invitationState: InvitationState = invitations[id]

    const uses = invitationState.uses + 1

    return {
      ...state,
      invitations: {
        ...invitations,
        [id]: {
          ...invitationState,
          uses,
        },
      },
    }
  }
