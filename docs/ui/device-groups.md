# Spec: Device Groups

A **Device Group** owns one set of Screens, with their Order and Schedules, that several Devices show together (ADR-0078). Each member renders the Screens for its own Device Model and Palette and walks the Order at its own pace; a member's own Screens are parked while it is in the Group. Read [README.md](./README.md) first; its shared patterns (loading, a failed load, saving, destructive actions, fresh data, time, phone) apply here and are not repeated, and the Screens parts are those of [devices.md](./devices.md).

- **Reference.** [Device Groups: one Screen set shared by several Devices](https://github.com/usetrmnl/kuroshiro/issues/1786), grilled on 2026-11-14 and 2026-11-15, and ADR-0078. There is no drawing; the Group page is built from the parts of the Device's Screens view and Settings.
- **Facts.** How the server behaves was read from `main` after #1798, which shipped the Group routes.

## Routes

| Route | Shows |
|---|---|
| `/devices` | The Devices list, with the Device Groups under the Devices ([devices.md](./devices.md#the-devices-list)). |
| `/device-groups/:groupId` | The Group's page. `?screen=:screenId` opens that Screen's row and scrolls to it. |
| `/device-groups/:groupId/screens/new` | Add Screen, for the Group. `?kind=plugin\|mashup\|link\|file\|html` preselects the kind. |
| `/device-groups/:groupId/screens/:screenId/html` | Edit HTML, for an HTML Screen of the Group. |

`:groupId` is the Group's id. A Group that does not exist gets "No Device Group here", with "It may have been deleted." and the link "All Devices". In the bar, the Devices entry is current on every `/device-groups` route.

## The Device Groups under the Devices

On the Devices list, under the Devices.

- Heading "Device Groups" on the heavy rule, with the plain button "New Group" at its right.
- One row per Group, the whole row a link to its page: the name at `text-md`, and under it "{n} Devices · {m} Screens" in `ink-soft`, singular where there is one.
- A Device in a Group says so among its facts in the Devices list: "In {Group}", after any firing Alert and before "Last seen".
- **"New Group"** opens a form in place under the heading, titled "New Group": the field "Name" with the hint "Every Device in the Group shows the same Screens.", "Create Group" (primary) and "Cancel". The field has the focus. An empty name is refused on the field: "A Device Group needs a name." A taken name is refused on the field as the API words it: "There is already a Device Group with that name." Creating opens the Group's page. "Cancel" closes the form and gives "New Group" the focus back.
- **Loading:** two `wash` bars and "Loading Device Groups". **Failed:** the notice "Could not load the Device Groups." under the heading; the Devices above are unaffected. **Empty:** "No Device Groups yet. A Group is one set of Screens that several Devices show together, each at its own pace."

## The Group page

`/device-groups/:groupId`

**For:** editing one set of Screens for several Devices, and seeing what each of them shows.

Title line with the Group's name, the link back "Devices" above it, and "Add Screen" (primary; a link to the Group's Add Screen; absent while the Group has no Screens, where the empty block carries it). Under it the lede "One set of Screens, shown by every Device in the Group. Each Device renders them for its own Device Model and Palette and walks the Order at its own pace.", then four sections.

### Group

A section of Setting rows, answering to `#group`.

| Row | Control | Notes |
|---|---|---|
| Name | text input | Saves as changed on blur or Enter. Required: "A Device Group needs a name." A taken name reads "Not saved. There is already a Device Group with that name." and keeps what was entered. The title and the Devices list follow on save. |

Under the section: "Every Device in the Group shows its Screens. Changes save as you make them."

### Devices in the Group

Answers to `#devices`.

- One row per member, by name: the name as a link to the Device's Screens view, under it "{Device Model} · {Palette}" in `ink-soft` (what the member has of the two), and the button "Remove" at the right.
- **"Remove"** confirms: "Take {Device} out of {Group}?" · "{Device} shows its own Screens again, from the first in its Order. Nothing is deleted." · "Remove". The member's state leaves every Screen row.
- **"Add a Device"** under the rows: a select of every Device that is not in this Group, by name, and the button "Add to {Group}", disabled until one is chosen. A Device in another Group is listed as "{Device} · in {other Group}". Under the select: "Its own Screens are parked while it is in {Group} and come back when it leaves. It starts {Group}'s Order from the first Screen."; for a Device from another Group the sentence starts "It leaves {other Group}." A refusal is shown under the controls. With every Device in the Group: "Every Device is in this Group already."
- **Empty:** "No Device in {Group} yet" with "A Device that joins shows the Group's Screens instead of its own. Its own Screens are kept and come back when it leaves."

### Screens in Order

The Device's "Screens in Order" ([devices.md](./devices.md#screens-in-order)) pointed at the Group, with these differences:

- A row's thumbnail is the first member's rendering of the Screen. In place of one Screen State the row words each member's: "Kitchen: Active Screen · Hallway: Up next", leaving out the members for which the Screen waits its turn. The row has the Active Screen look where any member shows the Screen, the Up next look where any member turns to it next.
- An opened row starts with the list "On each Device": for each member, the Screen as rendered for it (its own Device Model's shape; the rendering plate until it has been rendered, with "Not rendered yet. It renders when its turn first comes."), "Rendered {when}", the member's name and state ("Kitchen · Active Screen", "Hallway · Waiting its turn", with the qualifiers "picked by hand" and "holding image"), and "Show next" or "Back to Order" for that member where its Rotation could show the Screen at its next poll. With no member: "No Device shows it yet: {Group} has no Device."
- The Schedule editor, what the Screen is made from, "Rename", the move buttons and "Delete Screen" or "Unassign Plugin" are as on a Device. The confirmation of a removal names the Group where it named the Device: "Unassign Weather from {Group}?", "{Group}'s other Screens, which move up in the Order."
- A File Screen's facts say what it is converted for by the first member; its replacement is previewed as converted for the first member too, since the server converts for every member.
- Without a member the list says, under the heading: "No Device shows these Screens yet. Add a Device to the Group above."
- **Empty:** "Add {Group}'s first Screen" · "A Screen is one thing the Devices show: a Plugin, a Mashup, an image from a link or a file, or HTML you write. Every Device in {Group} shows the same Screens, each at its own pace." · "Add Screen" (primary).

### Delete {Group}

Answers to `#delete`. "Every Device in it goes back to its own Screens. The Group's Screens are deleted with it." and the button "Delete {Group}", which confirms: "Delete {Group}?" · Lost: "{Group} and its {n} Screens with their Schedules." · Stays: "{Device}, {Device}: each shows its own Screens again, from the first in its Order." (or "Every Device; none is in this Group.") · "Delete {Group}". Deleting opens the Devices list.

**Loading:** the Devices and the Screens as `wash` bars and rendering plates under their headings, and "Loading {Group}". **Failed:** the notice "Could not load {Group}."

## Add Screen and Edit HTML for a Group

The Device's Add Screen and Edit HTML ([devices.md](./devices.md#add-screen)), under the Group's frame. The link back reads "{Group}'s Screens". The new Screen is added to the Group; the Plugin kind's shortcut to Add a Plugin carries no Device. A File Screen says "It is converted for {Device Model}, {Palette}" of the first member, and the HTML preview renders as the first member does; a Group without a member reads "No preview: {Group} has no Device yet to render it for." in the preview's place.

## A Device in a Group

On the Device's Screens view ([devices.md](./devices.md#a-devices-screens-view)):

- The title line has no "Add Screen"; Screens are added on the Group.
- Under the "Screens in Order" heading: "Screens from **{Group}**, shown by every Device in it. They are edited there; {Device} walks the Order at its own pace.", the Group a link. The rows are the Group's Screens with this Device's Screen State, without the grip and without "Rename".
- An opened row has no move buttons and no "Delete Screen"; its Schedule is the summary alone under "Schedule"; what it is made from is the kind, one line (the link, the file's name, the Mashup's Plugins, or "Rendered from HTML written on the Group, on every poll."), "Edited on {Group}, for every Device in it." and the button "Open on {Group}", which opens the Group's page on that Screen. "Show next" and "Back to Order" stay: they pick for this Device.
- Under the rows, tucked and closed: "{Device}'s own Screens, parked" with the count, answering to `#own-screens`. Opened: "Kept while {Device} is in {Group}, and shown again from the first in their Order when it leaves. Nothing here can be changed until then." and the own Screens as dimmed rows without a state, each opening to "Parked. It comes back when {Device} leaves {Group}." A Device without own Screens reads "{Device} has no Screens of its own."
- **Empty**, a Group without Screens: "No Screens in {Group} yet" · "{Device} shows {Group}'s Screens, and the Group has none yet. Add one on the Group and every Device in it shows it." · "Open {Group}" (primary).

On the Device's Settings, in Display:

| Row | Control | Notes |
|---|---|---|
| Device Group | select, "None" then every Group by name | Saves on change: the Group's id, or `null` for "None". Note in a Group: "{Device} shows {Group}'s Screens; its own are parked until it leaves. Joining or leaving starts the Order from the first Screen.", the Group a link. Note in none: "{Device} shows its own Screens. In a Group it shows the Group's instead and parks its own; joining starts the Group's Order from the first Screen." Without any Group: "No Device Groups yet. Make one from the Devices list." (a link). |

## Components this spec adds

None. The Group page is built from the component inventory and the parts of the Device surfaces.

## Capability coverage

| Capability | Home |
|---|---|
| Make, rename, delete a Device Group | The Devices list's "New Group"; the Group page's Name row and "Delete {Group}" |
| Put a Device in a Group, take it out, move it between Groups | The Group page's "Add a Device" and "Remove"; the Device Group row of a Device's Settings |
| Edit the Group's Screens: add, reorder, Schedule, rename, delete, the source | The Group page's "Screens in Order", Add Screen and Edit HTML under the Group |
| See what each member shows and pick a member's next Screen | The member chips on each row and "On each Device" in an opened row |
| See a member's parked own Screens | "{Device}'s own Screens, parked" on the Device's Screens view |

## What this asks of the admin API

Shipped in #1798 and this slice: `GET`, `POST /device-groups`, `GET`, `PATCH`, `DELETE /device-groups/:id`, `GET /device-groups/:id/screens`, `PUT /device-groups/:id/screens/order`; `owner` on `POST /screens`, `POST /mashup` and `POST /plugins/:id/assign`; `deviceGroupId` on `PATCH /devices/:id`; `deviceGroup` on the Device summary and detail; `GET /devices/:id/screens/own`; each member's `imagePath` and `renderedAt` on a Group Screen; `DELETE /plugins/:id/assignments/device-groups/:groupId`.

## Open points

- A Plugin's page lists the Devices it is assigned to by pairing its assignments with the Devices; an assignment to a Group has no Device to pair with and is not shown there. Showing Groups on the Plugin page is left for its own issue.
- A Group has a name and nothing else of its own, as grilled; a note or a description was not asked for.
