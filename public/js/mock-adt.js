/**
 * Five9 Agent Desktop Toolkit (ADT) Mock Simulator
 * Handles Five9 postMessage protocol & Softphone UI logic inside iframe
 */

(function () {
    // State variables
    let agentState = 'Ready';
    let currentCallState = 'Idle'; // Idle, Dialing, Connected, Disposition
    let activePhoneNumber = '';
    let activeCampaign = 'Outbound_Sales';
    let callTimerInterval = null;
    let callDurationSeconds = 0;
    let currentCallId = null;

    // DOM Elements
    const displayLabel = document.getElementById('displayLabel');
    const displayNumber = document.getElementById('displayNumber');
    const displayStatus = document.getElementById('displayStatus');
    const btnCall = document.getElementById('btnCall');
    const btnHangup = document.getElementById('btnHangup');
    const inCallControls = document.getElementById('inCallControls');
    const dispositionPanel = document.getElementById('dispositionPanel');
    const protocolLog = document.getElementById('protocolLog');
    const agentStateSelect = document.getElementById('agentStateSelect');
    const keypadGrid = document.getElementById('keypadGrid');
    const dispositionSelect = document.getElementById('dispositionSelect');
    const btnSaveWrapup = document.getElementById('btnSaveWrapup');

    // Helper: Log message in bottom protocol stream view
    function logProtocol(msg, data) {
        const timeStr = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.style.marginBottom = '2px';
        entry.innerHTML = `<span style="color: #64748b;">[${timeStr}]</span> <strong>${msg}</strong> ${data ? JSON.stringify(data) : ''}`;
        protocolLog.appendChild(entry);
        protocolLog.scrollTop = protocolLog.scrollHeight;
        console.log(`[Five9 ADT Mock] ${msg}`, data || '');
    }

    // Initialize Event Listeners
    function init() {
        logProtocol('Five9 ADT Softphone Initialized');

        // Setup Keypad clicks
        document.querySelectorAll('.key-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (currentCallState === 'Idle') {
                    const key = btn.getAttribute('data-key');
                    activePhoneNumber += key;
                    displayNumber.innerText = activePhoneNumber || 'Ready to Dial';
                }
            });
        });

        // Agent state change
        agentStateSelect.addEventListener('change', (e) => {
            agentState = e.target.value;
            logProtocol(`Agent State Changed: ${agentState}`);
            sendEventToParent('agentStateChanged', { state: agentState });
        });

        // Call Button
        btnCall.addEventListener('click', () => {
            const num = activePhoneNumber || '+1 (555) 234-5678';
            initiateCall(num, 'Outbound_Sales');
        });

        // Hangup Button
        btnHangup.addEventListener('click', () => {
            endCall();
        });

        // Save Wrap-up Button
        btnSaveWrapup.addEventListener('click', () => {
            completeWrapup();
        });

        // Listen for postMessage from parent CRM window
        window.addEventListener('message', handleParentMessage);

        // Perform initial connection announcement to parent window
        announcePresenceToParent();
    }

    // Announce Five9 ADT presence to parent window
    function announcePresenceToParent() {
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    source: 'Five9ADT',
                    event: 'adtLoaded',
                    timestamp: new Date().toISOString()
                }, '*');
                logProtocol('Sent adtLoaded handshake to parent window');
            }
        } catch (e) {
            console.error('Error announcing presence:', e);
        }
    }

    // Handle messages coming from CRM Parent Window (via CRM SDK or postMessage)
    function handleParentMessage(event) {
        const data = event.data;
        if (!data) return;

        // Log raw postMessage
        if (typeof data === 'object') {
            logProtocol(`Received postMessage (${data.action || data.type || data.event || 'msg'}):`, data);
        }

        // 1. Five9 CRM SDK Click-to-Dial request
        if (data.action === 'click2dial' || data.type === 'click2dial' || (data.request && data.request.attrName === 'click2dial')) {
            const clickData = data.clickToDialData || data.data || (data.request && data.request.args && data.request.args[0]) || {};
            const num = clickData.clickToDialNumber || clickData.number || clickData.phone || '1234567890';
            const campaign = clickData.preselectedCampaignName || clickData.campaign || 'Outbound_Sales';
            
            logProtocol(`⚡ CLICK-TO-DIAL TRIGGERED: ${num} [Campaign: ${campaign}]`);
            
            // Respond to parent acknowledge if RPC request
            if (data.id && event.source) {
                event.source.postMessage({ id: data.id, response: { success: true } }, '*');
            }

            initiateCall(num, campaign, clickData.crmObject);
        }

        // 2. getAdtConfig query
        if (data.action === 'getAdtConfig' || (data.request && data.request.attrName === 'getAdtConfig')) {
            if (data.id && event.source) {
                event.source.postMessage({
                    id: data.id,
                    response: {
                        providerName: 'Five9 ADT Simulator',
                        myCallsTodayEnabled: true,
                        autoOpenCallLog: true
                    }
                }, '*');
            }
        }
    }

    // Initiate Call (Dialing -> Ringing -> Connected)
    function initiateCall(phoneNumber, campaign, crmObject) {
        currentCallState = 'Dialing';
        activePhoneNumber = phoneNumber;
        activeCampaign = campaign || 'Outbound_Sales';
        currentCallId = 'CALL-' + Math.floor(100000 + Math.random() * 900000);

        // Update UI
        displayLabel.innerText = `OUTBOUND CALL (${activeCampaign})`;
        displayNumber.innerText = activePhoneNumber;
        displayStatus.innerText = 'RINGING...';
        displayStatus.style.color = '#f59e0b';

        btnCall.style.display = 'none';
        btnHangup.style.display = 'flex';
        keypadGrid.style.opacity = '0.5';

        logProtocol(`Call Initiated to ${activePhoneNumber} (Call ID: ${currentCallId})`);

        // Trigger CRM SDK search and screenPop to parent CRM
        triggerScreenPop(activePhoneNumber, crmObject);

        // Simulate Call Connect after 1.5 seconds
        setTimeout(() => {
            if (currentCallState === 'Dialing') {
                connectCall();
            }
        }, 1500);
    }

    // Trigger Screen Pop event to parent CRM window
    function triggerScreenPop(phoneNumber, crmObject) {
        const screenPopPayload = {
            action: 'screenPop',
            callId: currentCallId,
            number: phoneNumber,
            campaign: activeCampaign,
            customerName: (crmObject && crmObject.name) ? crmObject.name : 'John Customer',
            crmObjectId: (crmObject && crmObject.id) ? crmObject.id : '101'
        };

        logProtocol('Sending ScreenPop to CRM Portal', screenPopPayload);
        sendEventToParent('screenPop', screenPopPayload);
    }

    // Connect Call
    function connectCall() {
        currentCallState = 'Connected';
        displayStatus.innerText = 'CONNECTED 00:00';
        displayStatus.style.color = '#10b981';
        inCallControls.style.display = 'grid';

        callDurationSeconds = 0;
        clearInterval(callTimerInterval);
        callTimerInterval = setInterval(() => {
            callDurationSeconds++;
            const mins = String(Math.floor(callDurationSeconds / 60)).padStart(2, '0');
            const secs = String(callDurationSeconds % 60).padStart(2, '0');
            displayStatus.innerText = `CONNECTED ${mins}:${secs}`;
        }, 1000);

        logProtocol(`Call Connected. Timer started.`);
        sendEventToParent('callConnected', { callId: currentCallId, number: activePhoneNumber });
    }

    // End Call
    function endCall() {
        currentCallState = 'Disposition';
        clearInterval(callTimerInterval);

        displayStatus.innerText = `CALL ENDED (${callDurationSeconds}s)`;
        displayStatus.style.color = '#ef4444';

        btnHangup.style.display = 'none';
        inCallControls.style.display = 'none';
        dispositionPanel.style.display = 'flex';

        logProtocol(`Call Ended. Waiting for Disposition...`);
        sendEventToParent('callEnded', { callId: currentCallId, duration: callDurationSeconds });
    }

    // Save Disposition & Send Call Log event to parent CRM
    function completeWrapup() {
        const disposition = dispositionSelect.value;
        const callLogPayload = {
            action: 'saveLog',
            callId: currentCallId,
            phoneNumber: activePhoneNumber,
            campaign: activeCampaign,
            duration: callDurationSeconds,
            disposition: disposition,
            notes: `Outbound call to ${activePhoneNumber}. Result: ${disposition}.`,
            timestamp: new Date().toISOString()
        };

        logProtocol('Sending saveLog CRM SDK Event to Parent', callLogPayload);
        sendEventToParent('saveLog', callLogPayload);

        // Reset UI to Idle
        currentCallState = 'Idle';
        activePhoneNumber = '';
        displayLabel.innerText = 'ENTER PHONE NUMBER';
        displayNumber.innerText = 'Ready to Dial';
        displayStatus.innerText = 'IDLE / READY';
        displayStatus.style.color = '#10b981';

        btnCall.style.display = 'flex';
        dispositionPanel.style.display = 'none';
        keypadGrid.style.opacity = '1';
    }

    // Send postMessage event to parent CRM window
    function sendEventToParent(eventName, payload) {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                source: 'Five9ADT',
                event: eventName,
                payload: payload
            }, '*');
        }
    }

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', init);
})();
