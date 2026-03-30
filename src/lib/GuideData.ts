export interface GuideCard {
    id: string;
    title: string;
    description: string;
    category: "basics" | "shortcuts" | "workflows" | "new";
    content: string;
}

export const GUIDE_BASICS: GuideCard[] = [
    {
        id: "concepts",
        title: "Core Concepts",
        category: "basics",
        description: "Understand the ODE hierarchy and nodes.",
        content: "ODETool uses a hierarchical node system. Everything is a node: Folders, Files, and Support Tickets. Nodes are numbered automatically (1, 1.1, 1.2) to help you keep track of deep structures."
    },
    {
        id: "wings",
        title: "The Dual-Wing Architecture",
        category: "basics",
        description: "Synchronization between Tree and Desktop.",
        content: "Your Tree on the left is the 'Brain'. The Desktop on the right is the 'Workspace'. Any changes in the Tree are mirrored to your project folder on your PC, ensuring your data is always accessible outside the app."
    }
];

export const GUIDE_SHORTCUTS: GuideCard[] = [
    {
        id: "command-bar",
        title: "Command Bar",
        category: "shortcuts",
        description: "Access any action instantly.",
        content: "Press **Ctrl + K** to open the Command Bar. From here you can create tickets, run QA, or search through everything."
    },
    {
        id: "navigation",
        title: "Quick Navigation",
        category: "shortcuts",
        description: "Move fast without a mouse.",
        content: "- **Esc**: Close modals, menus, or clear selections.\n- **Arrows**: Navigate the Tree.\n- **Enter**: Open selected node.\n- **Delete**: Remove selected nodes."
    }
];
