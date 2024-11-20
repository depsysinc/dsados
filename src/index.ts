import './styles.css';

import { DepSysOS } from './depSysOS';

async function initApp(): Promise<void> {
    console.log("DepSys terminal firmware initializing");

    await document.fonts.load('16px CRTFont');

    // Create a div container for the terminal
    const terminalContainer = document.createElement("div");
    terminalContainer.id = "terminal-container";
    
    // Append the terminal container to the body of the document
    document.body.appendChild(terminalContainer);

    // Boot the OS
    const os = new DepSysOS(terminalContainer);
}

initApp();