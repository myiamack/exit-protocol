/* Plain scenario data for Level 2 (Split Brief). No game behavior. */

const MEDLINE_SPRINT_1 = {
  id: "medline-sprint-1",
  title: "Medline Sprint 1 Demo",
  tasks: [
    { id: "A", name: "Build the login page", days: 3 },
    { id: "B", name: "Write the client status report", days: 1 },
    { id: "C", name: "Import Medline data", days: 2 },
    { id: "D", name: "Build the dashboard", days: 2 },
  ],
  cards: [
    {
      id: "deadline",
      title: "Deadline",
      text: "Demo is in 4 work days. Only finished tasks count.",
      botNote: "Demo in 4 work days. Only finished tasks count.",
    },
    {
      id: "must-have",
      title: "Must-have",
      text: "Client: 'We must see the dashboard at the demo.'",
      botNote: "Client must see the dashboard (D) at the demo.",
    },
    {
      id: "blocker",
      title: "Blocker",
      text: "The dashboard needs real data. Data import must finish first.",
      botNote: "Dashboard needs real data. Data import (C) must finish first.",
    },
    {
      id: "scope",
      title: "Scope",
      text: "Login is not in scope for Sprint 1.",
      botNote: "Login page (A) is not in scope for Sprint 1.",
    },
    {
      id: "red-herring",
      title: "Red herring",
      text: "Marketing loves long status reports. Do one if you can.",
      botNote: "Marketing wants long status reports if we have time.",
    },
  ],
  preTwistAnswer: ["C", "D"],
  twist: {
    id: "twist",
    title: "Ghosted Teammate",
    text: "Data vendor is down. Import can't start this sprint. Client will accept the dashboard with sample data. Send them a status report after the dashboard explaining the change.",
    botNote: "Vendor down: skip import, do dashboard with sample data then status report.",
  },
  postTwistAnswer: ["D", "B"],
};

const Scenarios = {
  MEDLINE_SPRINT_1,
};

export { Scenarios };
