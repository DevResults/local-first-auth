﻿import { ADMIN } from '@/role'
import { debug } from '@/util'
import {
  all,
  connect,
  connectPhoneWithInvitation,
  connectWithInvitation,
  disconnect,
  disconnection,
  expectEveryoneToKnowEveryone,
  joinTestChannel,
  setup,
  TestChannel,
  updated,
} from '@/util/testing'
import { pause } from '@/util/testing/pause'
import { InviteeDeviceInitialContext } from './types'

const log = debug('lf:auth:test')

describe('connection', () => {
  describe('sync', () => {
    it('updates remote user after connecting', async () => {
      const { alice, bob } = setup('alice', 'bob')

      // at this point, Alice and Bob have the same signature chain

      // 👩🏾 but now Alice does some stuff
      alice.team.addRole('managers')
      alice.team.addMemberRole('bob', 'managers')

      // 👨🏻‍🦲 Bob hasn't connected, so he doesn't have Alice's changes
      expect(bob.team.hasRole('managers')).toBe(false)
      expect(bob.team.memberHasRole('bob', 'managers')).toBe(false)

      // 👩🏾 👨🏻‍🦲 Alice and Bob connect
      await connect(alice, bob)

      // ✅ 👨🏻‍🦲 Bob is up to date with Alice's changes
      expect(bob.team.hasRole('managers')).toBe(true)
      expect(bob.team.memberHasRole('bob', 'managers')).toBe(true)
    })

    it('updates local user after connecting', async () => {
      const { alice, bob } = setup('alice', 'bob')

      // at this point, Alice and Bob have the same signature chain

      // 👨🏻‍🦲 but now Bob does some stuff
      bob.team.addRole('managers')
      bob.team.addMemberRole('bob', 'managers')

      // 👩🏾 👨🏻‍🦲 Alice and Bob connect
      await connect(alice, bob)

      // ✅ 👩🏾 Alice is up to date with Bob's changes
      expect(alice.team.hasRole('managers')).toBe(true)
      expect(alice.team.memberHasRole('bob', 'managers')).toBe(true)
    })

    it('updates remote user while connected', async () => {
      const { alice, bob } = setup('alice', 'bob')

      // 👩🏾 👨🏻‍🦲 Alice and Bob connect
      await connect(alice, bob)

      // at this point, Alice and Bob have the same signature chain

      // 👨🏻‍🦲 now Bob does some stuff
      alice.team.addRole('managers')
      alice.team.addMemberRole('bob', 'managers')

      await updated(alice, bob)
      await updated(alice, bob)

      // ✅ 👩🏾 Alice is up to date with Bob's changes
      expect(bob.team.hasRole('managers')).toBe(true)
      expect(bob.team.memberHasRole('bob', 'managers')).toBe(true)
    })

    it('updates local user while connected', async () => {
      const { alice, bob } = setup('alice', 'bob')

      // 👩🏾 👨🏻‍🦲 Alice and Bob connect
      await connect(alice, bob)

      // at this point, Alice and Bob have the same signature chain

      // 👨🏻‍🦲 now Bob does some stuff
      bob.team.addRole('managers')
      bob.team.addMemberRole('bob', 'managers')

      await updated(alice, bob)
      await updated(alice, bob)

      // ✅ 👩🏾 Alice is up to date with Bob's changes
      expect(alice.team.hasRole('managers')).toBe(true)
      expect(alice.team.memberHasRole('bob', 'managers')).toBe(true)
    })

    it('resolves concurrent non-conflicting changes when updating', async () => {
      const { alice, bob } = setup('alice', 'bob')

      // 👩🏾 Alice creates a new role
      expect(alice.team.hasRole('MANAGERS')).toBe(false)
      alice.team.addRole('MANAGERS')
      expect(alice.team.hasRole('MANAGERS')).toBe(true)

      // 👨🏻‍🦲 concurrently, Bob invites Charlie
      const { id } = bob.team.inviteMember()
      expect(bob.team.hasInvitation(id)).toBe(true)

      // Bob doesn't see the new role
      expect(bob.team.hasRole('MANAGERS')).toBe(false)

      // Alice doesn't see Bob's invitation for Charlie
      expect(alice.team.hasInvitation(id)).toBe(false)

      // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
      await connect(alice, bob)

      // ✅ now Bob does see the new role 👨🏻‍🦲💭
      expect(bob.team.hasRole('MANAGERS')).toBe(true)

      // ✅ and Alice does see the invitation 👩🏾💭
      expect(alice.team.hasInvitation(id)).toBe(true)
    })

    it('resolves concurrent duplicate changes when updating', async () => {
      const { alice, bob } = setup('alice', 'bob')

      // 👩🏾 Alice creates a new role
      alice.team.addRole('MANAGERS')
      expect(alice.team.hasRole('MANAGERS')).toBe(true)

      // 👨🏻‍🦲 concurrently, Bob adds the same role
      bob.team.addRole('MANAGERS')
      expect(bob.team.hasRole('MANAGERS')).toBe(true)

      // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
      await connect(alice, bob)

      // ✅ nothing blew up, and they both have the role
      expect(alice.team.hasRole('MANAGERS')).toBe(true)
      expect(bob.team.hasRole('MANAGERS')).toBe(true)
    })

    it('resolves concurrent duplicate removals', async () => {
      const { alice, bob } = setup('alice', 'bob', 'charlie')

      // 👳🏽‍♂️ Charlie is a member
      expect(alice.team.has('charlie')).toBe(true)
      expect(bob.team.has('charlie')).toBe(true)

      // 👨🏻‍🦲 Bob removes 👳🏽‍♂️ Charlie
      bob.team.remove('charlie')

      // 👩🏾 concurrently, Alice also removes 👳🏽‍♂️ Charlie
      alice.team.remove('charlie')

      // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
      await connect(alice, bob)

      // ✅ nothing blew up, and Charlie has been removed on both sides 🚫👳🏽‍♂️
      expect(alice.team.has('charlie')).toBe(false)
      expect(bob.team.has('charlie')).toBe(false)
    })

    it('lets a member remove the founder', async () => {
      const { alice, bob } = setup('alice', 'bob')

      // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
      await connect(alice, bob)

      // 👨🏻‍🦲 Bob removes Alice
      bob.team.remove('alice')

      // 👩🏾🔌👨🏻‍🦲 Alice is no longer a member, so they're disconnected
      await disconnection(alice, bob)

      // ✅ Alice is no longer on the team 👩🏾👎
      expect(bob.team.has('alice')).toBe(false)
    })

    it('eventually updates disconnected members when someone uses an invitation to join', async () => {
      const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })

      // 👩🏾📧👳🏽‍♂️ Alice invites Charlie
      const { seed } = alice.team.inviteMember()

      // 👳🏽‍♂️📧<->👩🏾 Charlie connects to Alice and uses his invitation to join
      await connectWithInvitation(alice, charlie, seed)

      // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
      await connect(alice, bob)

      // ✅
      expectEveryoneToKnowEveryone(alice, charlie, bob)
    })

    it('updates connected members when someone uses an invitation to join', async () => {
      const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })

      // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
      await connect(alice, bob)

      // 👩🏾📧👳🏽‍♂️👴 Alice invites Charlie
      const { seed } = alice.team.inviteMember()

      // 👳🏽‍♂️📧<->👩🏾 Charlie connects to Alice and uses his invitation to join
      await connectWithInvitation(alice, charlie, seed)

      // ✅
      expectEveryoneToKnowEveryone(alice, charlie, bob)
    })

    it('resolves concurrent duplicate invitations when updating', async () => {
      const { alice, bob, charlie, dwight } = setup([
        'alice',
        'bob',
        { user: 'charlie', member: false },
        { user: 'dwight', member: false },
      ])

      // 👩🏾📧👳🏽‍♂️👴 Alice invites Charlie and Dwight
      const aliceInvitesCharlie = alice.team.inviteMember()
      const aliceInvitesDwight = alice.team.inviteMember() // invitation unused, but that's OK

      // 👨🏻‍🦲📧👳🏽‍♂️👴 concurrently, Bob invites Charlie and Dwight
      const bobInvitesCharlie = bob.team.inviteMember() // invitation unused, but that's OK
      const bobInvitesDwight = bob.team.inviteMember()

      // 👳🏽‍♂️📧<->👩🏾 Charlie connects to Alice and uses his invitation to join
      log('Charlie connects to Alice and uses his invitation to join')
      await connectWithInvitation(alice, charlie, aliceInvitesCharlie.seed)

      // 👴📧<->👨🏻‍🦲 Dwight connects to Bob and uses his invitation to join
      log('Dwight connects to Bob and uses his invitation to join')
      await connectWithInvitation(bob, dwight, bobInvitesDwight.seed)

      // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
      log('Alice and Bob connect')
      await connect(alice, bob)

      await updated(alice, bob)

      // ✅ No problemo
      log('No problemo')
      expectEveryoneToKnowEveryone(alice, charlie, bob, dwight)
    })

    it(`handles concurrent admittance of the same invitation`, async () => {
      const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })

      // 👩🏾📧👳🏽‍♂️👴 Alice makes an invitation for one person
      const { seed } = alice.team.inviteMember()

      // 👩🏾<->👨🏻‍🦲 Alice and Bob connect, so Bob knows about the invitation
      await connect(alice, bob)
      await disconnect(alice, bob)

      await Promise.all([
        // 👳🏽‍♂️📧<->👩🏾 Charlie presents his invitation to Alice
        connectWithInvitation(alice, charlie, seed),

        // 👳🏽‍♂️📧<-> 👨🏻‍🦲 concurrently Charlie presents his invitation to Bob
        connectWithInvitation(bob, charlie, seed),
      ])

      // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
      await connect(alice, bob)

      // ✅ It all works out
      expectEveryoneToKnowEveryone(alice, bob, charlie)
    })

    it('resolves mutual demotions in favor of the senior member', async () => {
      const { alice, bob } = setup('alice', 'bob')

      // 👨🏻‍🦲 Bob removes 👩🏾 Alice from admin role
      bob.team.removeMemberRole('alice', ADMIN)

      // 👩🏾 Alice concurrently removes 👨🏻‍🦲 Bob from admin role
      alice.team.removeMemberRole('bob', ADMIN)

      // 👩🏾<->👨🏻‍🦲 Alice and Bob connect. Bob's demotion of Alice is discarded (because they were
      // done concurrently and Alice is senior so she wins)
      await connect(alice, bob)

      // ✅ Alice is still an admin 👩🏾👍
      expect(alice.team.memberIsAdmin('alice')).toBe(true)
      expect(bob.team.memberIsAdmin('alice')).toBe(true)

      // ✅ Bob is no longer an admin 👨🏻‍🦲👎
      expect(alice.team.memberIsAdmin('bob')).toBe(false)
      expect(bob.team.memberIsAdmin('bob')).toBe(false)

      // ✅ They are still connected 👩🏾<->👨🏻‍🦲
      expect(alice.getState('bob')).toEqual('connected')
      expect(bob.getState('alice')).toEqual('connected')
    })

    it('resolves mutual removals in favor of the senior member', async () => {
      const { alice, bob, charlie, dwight } = setup('alice', 'bob', 'charlie', 'dwight')

      // 👨🏻‍🦲 Bob removes 👩🏾 Alice
      bob.team.remove('alice')

      // 👩🏾 Alice concurrently removes 👨🏻‍🦲 Bob
      alice.team.remove('bob')

      // 👳🏽‍♂️<->👨🏻‍🦲 Charlie and Bob connect
      await connect(bob, charlie)
      await updated(bob, charlie)

      // 👳🏽‍♂️💭 Charlie now knows that Bob has removed Alice
      expect(charlie.team.has('alice')).toBe(false)

      // 👴<->👩🏾 Dwight and Alice connect
      await connect(alice, dwight)
      await updated(alice, dwight)

      // 👴💭 Dwight now knows that Alice has removed Bob
      expect(dwight.team.has('bob')).toBe(false)

      // 👴<->👳🏽‍♂️ Dwight and Charlie connect
      await connect(dwight, charlie)
      await updated(dwight, charlie)

      // 👴💭 👳🏽‍♂️💭 Both Dwight and Charlie now know about the mutual conflicting removals.

      // They each discard Bob's removal of Alice (because they were done concurrently and
      // Alice is senior so she wins)

      // ✅ Both kept Alice 👩🏾👍
      expect(dwight.team.has('alice')).toBe(true)
      expect(charlie.team.has('alice')).toBe(true)

      // ✅ Both removed Bob 👨🏻‍🦲👎
      expect(dwight.team.has('bob')).toBe(false)
      expect(charlie.team.has('bob')).toBe(false)

      // ✅ Charlie is disconnected from Bob because Bob is no longer a member 👳🏽‍♂️🔌👨🏻‍🦲
      await disconnection(bob, charlie)
    })

    it(`when a member is demoted and makes concurrent admin-only changes, discards those changes`, async () => {
      const { alice, bob } = setup('alice', 'bob', { user: 'charlie', admin: false })

      // 👩🏾 Alice removes 👨🏻‍🦲 Bob from admin role
      alice.team.removeMemberRole('bob', ADMIN)

      // 👨🏻‍🦲 concurrently, Bob makes 👳🏽‍♂️ Charlie an admin
      bob.team.addMemberRole('charlie', ADMIN)
      expect(bob.team.memberHasRole('charlie', ADMIN)).toBe(true)

      // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
      await connect(alice, bob)

      // ✅ Bob's promotion of Charlie is discarded, because Bob concurrently lost admin privileges. 🚫👨🏻‍🦲👳🏽‍♂️
      expect(alice.team.memberHasRole('charlie', ADMIN)).toBe(false)
      expect(bob.team.memberHasRole('charlie', ADMIN)).toBe(false)
    })

    it(`when a member is demoted and concurrently adds a device, the new device is kept`, async () => {
      const { alice, bob } = setup('alice', 'bob')

      // 👩🏾 Alice removes 👨🏻‍🦲 Bob from admin role
      alice.team.removeMemberRole('bob', ADMIN)

      // 👨🏻‍🦲💻📧📱 concurrently, on his laptop, Bob invites his phone
      const { seed } = bob.team.inviteDevice()

      // 💻<->📱 Bob's phone and laptop connect and the phone joins
      await connectPhoneWithInvitation(bob, seed)

      // 👨🏻‍🦲👍📱 Bob's phone is added to his list of devices
      expect(bob.team.members('bob').devices).toHaveLength(2)

      // 👩🏾 Alice doesn't know about the new device
      expect(alice.team.members('alice').devices).toHaveLength(1)

      // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
      await connect(alice, bob)

      // // ✅ Bob's phone is still in his devices
      expect(bob.team.members('bob').devices).toHaveLength(2)

      // // ✅ Alice knows about the new device
      expect(alice.team.members('bob').devices).toHaveLength(2)
    })

    it('sends updates across multiple hops', async () => {
      const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')

      // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
      await connect(alice, bob)
      // 👨🏻‍🦲<->👳🏽‍♂️ Bob and Charlie connect
      await connect(bob, charlie)

      // 👩🏾 Alice creates a new role
      alice.team.addRole('MANAGERS')

      await Promise.all([
        updated(alice, bob), //
        updated(bob, charlie),
      ])

      // ✅ Charlie sees the new role, even though he's not connected directly to Alice 👳🏽‍♂️💭
      expect(charlie.team.hasRole('MANAGERS')).toEqual(true)
    })

    it('syncs up three ways - changes made after connecting', async () => {
      const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')

      const allUpdated = () =>
        Promise.all([
          updated(alice, bob), //
          updated(bob, charlie),
          updated(alice, charlie),
        ])

      // 👩🏾<->👨🏻‍🦲<->👳🏽‍♂️ Alice, Bob, and Charlie all connect to each other
      await connect(alice, bob)
      await connect(bob, charlie)
      await connect(alice, charlie)

      // <-> while connected...

      // 👩🏾 Alice adds a new role
      alice.team.addRole('ALICES_FRIENDS')

      // 👨🏻‍🦲 Bob adds a new role
      bob.team.addRole('BOBS_FRIENDS')

      // TODO: should work with this uncommented
      // 👳🏽‍♂️ Charlie adds a new role
      // charlie.team.addRole('CHARLIES_FRIENDS')

      await allUpdated()

      // ✅ All three get the three new roles
      expect(bob.team.hasRole('ALICES_FRIENDS')).toBe(true)
      expect(charlie.team.hasRole('ALICES_FRIENDS')).toBe(true)
      // expect(alice.team.hasRole('CHARLIES_FRIENDS')).toBe(true)
      // expect(bob.team.hasRole('CHARLIES_FRIENDS')).toBe(true)
      expect(alice.team.hasRole('BOBS_FRIENDS')).toBe(true)
      expect(charlie.team.hasRole('BOBS_FRIENDS')).toBe(true)
    })

    it('syncs up three ways - changes made before connecting', async () => {
      const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')

      // 🔌 while disconnected...

      // 👩🏾 Alice adds a new role
      alice.team.addRole('ALICES_FRIENDS')

      // 👨🏻‍🦲 Bob adds a new role
      bob.team.addRole('BOBS_FRIENDS')

      // 👳🏽‍♂️ Charlie adds a new role
      charlie.team.addRole('CHARLIES_FRIENDS')

      // 👩🏾<->👨🏻‍🦲<->👳🏽‍♂️ Alice, Bob, and Charlie all connect to each other
      await connect(alice, bob)
      await connect(bob, charlie)
      await connect(alice, charlie)

      // ✅ All three get the three new roles
      expect(bob.team.hasRole('ALICES_FRIENDS')).toBe(true)
      expect(charlie.team.hasRole('ALICES_FRIENDS')).toBe(true)
      expect(alice.team.hasRole('CHARLIES_FRIENDS')).toBe(true)
      expect(bob.team.hasRole('CHARLIES_FRIENDS')).toBe(true)
      expect(alice.team.hasRole('BOBS_FRIENDS')).toBe(true)
      expect(charlie.team.hasRole('BOBS_FRIENDS')).toBe(true)
    })

    it('syncs up three ways - duplicate changes', async () => {
      const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')

      // 🔌 while disconnected...

      // 👩🏾 Alice adds a new role
      alice.team.addRole('MANAGERS')

      // 👨🏻‍🦲 Bob adds the same role
      bob.team.addRole('MANAGERS')

      // 👳🏽‍♂️ Charlie adds the same role!! WHAT??!!
      charlie.team.addRole('MANAGERS')

      // 👩🏾<->👨🏻‍🦲<->👳🏽‍♂️ Alice, Bob, and Charlie all connect to each other
      await connect(alice, bob)
      await connect(bob, charlie)
      await connect(alice, charlie)

      // ✅ All three get the three new roles, and nothing bad happened
      expect(alice.team.hasRole('MANAGERS')).toBe(true)
      expect(bob.team.hasRole('MANAGERS')).toBe(true)
      expect(charlie.team.hasRole('MANAGERS')).toBe(true)
    })

    it('resolves circular concurrent demotions ', async () => {
      const { alice, bob, charlie, dwight } = setup('alice', 'bob', 'charlie', 'dwight')

      // Bob demotes Charlie
      bob.team.removeMemberRole('charlie', ADMIN)

      // Charlie demotes Alice
      charlie.team.removeMemberRole('alice', ADMIN)

      // Alice demotes Bob
      alice.team.removeMemberRole('bob', ADMIN)

      // Dwight connects to all three
      await connect(dwight, alice)
      await connect(dwight, bob)
      await connect(dwight, charlie)

      const isAdmin = dwight.team.memberIsAdmin

      // Bob is no longer an admin
      expect(isAdmin('bob')).toBe(false)

      // Alice is still an admin (because seniority)
      expect(isAdmin('alice')).toBe(true)

      // Charlie is still an admin (because Bob demoted him while being demoted)
      expect(isAdmin('charlie')).toBe(true)
    })

    it('Alice promotes Bob then demotes him', async () => {
      const { alice, bob } = setup('alice', { user: 'bob', admin: false })
      await connect(alice, bob)

      // 👨🏻‍🦲 Bob is not an admin
      expect(bob.team.memberIsAdmin('bob')).toBe(false)

      // 👩🏾 Alice promotes Bob
      alice.team.addMemberRole('bob', ADMIN)
      await updated(alice, bob)

      // 👨🏻‍🦲 Bob sees that he is admin
      expect(bob.team.memberIsAdmin('bob')).toBe(true)

      // 👩🏾 Alice demotes Bob
      alice.team.removeMemberRole('bob', ADMIN)
      await updated(alice, bob)

      // 👨🏻‍🦲 Bob sees that he is no longer admin
      expect(bob.team.memberIsAdmin('bob')).toBe(false)
    })

    it(`Eve steals Bob's phone; Bob heals the team`, async () => {
      const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')
      await connect(alice, bob)
      await connect(bob, charlie)

      // Bob invites his phone and it joins
      const { seed } = bob.team.inviteDevice()
      await connectPhoneWithInvitation(bob, seed)

      // Bob and Alice know about Bob's phone
      expect(bob.team.members('bob').devices).toHaveLength(2)
      expect(alice.team.members('bob').devices).toHaveLength(2)

      // Eve steals Bob's phone.

      // From his laptop, Bob removes his phone from the team
      bob.team.removeDevice('bob', 'bob::phone')
      await updated(alice, bob)

      expect(bob.team.members('bob').devices).toHaveLength(1)

      await pause(500)

      // Alice can see that Bob only has one device
      expect(alice.team.members('bob').devices).toHaveLength(1)

      // Eve tries to connect to Charlie from Bob's phone, but she can't
      const phoneContext = {
        device: bob.phone,
        user: bob.user,
        team: bob.team,
      }

      const join = joinTestChannel(new TestChannel())

      const eveOnBobsPhone = join(phoneContext).start()
      const heyCharlie = join(charlie.context).start()

      // GRRR foiled again
      await all([eveOnBobsPhone, heyCharlie], 'disconnected')
    })

    it.skip(`Eve steals Bob's laptop; Alice heals the team`, async () => {
      const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')
      await connect(alice, bob)
      await connect(alice, charlie)

      expect(alice.team.adminKeys().generation).toBe(0)
      expect(alice.team.teamKeys().generation).toBe(0)

      // Eve steals Bob's laptop, so Alice removes Bob's laptop from the team
      alice.team.removeDevice('bob', 'laptop')

      // Alice can see that Bob has no devices
      expect(alice.team.members('bob').devices).toHaveLength(0)

      await updated(alice, charlie)

      // The keys have been rotated
      expect(charlie.team.adminKeys().generation).toBe(1)
      expect(charlie.team.teamKeys().generation).toBe(1)

      // Eve tries to connect to Charlie from Bob's laptop, but she can't
      connect(bob, charlie)

      // GRRR foiled again
      await disconnection(bob, charlie)

      const { seed } = alice.team.inviteDevice()

      const phoneContext = {
        userName: bob.userName,
        device: bob.phone,
        invitationSeed: seed,
      } as InviteeDeviceInitialContext

      const join = joinTestChannel(new TestChannel())

      const aliceBobPhone = join(alice.context).start()
      const bobPhone = join(phoneContext).start()

      await all([aliceBobPhone, bobPhone], 'connected')

      // TODO: This will require a distinct workflow. Alice can't admit Bob's device because she's not Bob.
      // When a user admits their own device, they create a lockbox for the device so that it has the user keys.
      // In this case, Bob's old user keys are gone forever, so the device needs to be able to generate new ones.
    })
  })
})