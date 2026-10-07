/**
 * Five9 CRM SDK Controller
 * Handles initialization, callback registrations, and click-to-dial operations
 */

window.Five9CrmManager = (function () {
    let crmApi = null;
    let interactionApi = null;
    let isSdkInitialized = false;

    // Log callback handler registered by app.js UI
    let logInspectorCallback = null;
    let screenPopUiCallback = null;
    let saveLogUiCallback = null;

    function setLogInspector(callback) {
        logInspectorCallback = callback;
    }

    function setScreenPopHandler(callback) {
        screenPopUiCallback = callback;
    }

    function setSaveLogHandler(callback) {
        saveLogUiCallback = callback;
    }

    function logEvent(direction, method, data) {
        if (logInspectorCallback) {
            logInspectorCallback(direction, method, data);
        }
        console.log(`[Five9 CRM Manager] [${direction}] ${method}:`, data);
    }

    // Initialize Five9 CRM SDK
    function initSdk() {
        logEvent('SYSTEM', 'Init', 'Initializing Five9 CRM SDK...');

        if (window.Five9 && window.Five9.CrmSdk) {
            try {
                // Instantiate Five9 SDK APIs
                crmApi = window.Five9.CrmSdk.crmApi();
                interactionApi = window.Five9.CrmSdk.interactionApi();

                // Register API Callbacks required by Five9 ADT
                crmApi.registerApi({
                    getAdtConfig: function () {
                        logEvent('INBOUND', 'getAdtConfig', 'ADT requested configuration');
                        const config = {
                            providerName: 'ApexCRM Portal',
                            myCallsTodayEnabled: true,
                            myChatsTodayEnabled: true,
                            myEmailsTodayEnabled: true,
                            showContactInfo: true,
                            autoOpenCallLog: true,
                            clickToDialEnabled: true
                        };
                        return Promise.resolve(config);
                    },

                    search: function (params) {
                        logEvent('INBOUND', 'search', params);
                        // Search CRM database for matching contact
                        const matchingContact = {
                            id: '101',
                            name: 'John Customer',
                            phone: params ? params.number : '1234567890',
                            email: 'john.customer@example.com',
                            company: 'Acme Corporation',
                            tier: 'VIP Gold'
                        };
                        return Promise.resolve({
                            crmObjects: [matchingContact],
                            screenPopObject: matchingContact
                        });
                    },

                    screenPop: function (params) {
                        logEvent('INBOUND', 'screenPop', params);
                        if (screenPopUiCallback) {
                            screenPopUiCallback(params);
                        }
                        return Promise.resolve({ success: true });
                    },

                    saveLog: function (params) {
                        logEvent('INBOUND', 'saveLog', params);
                        if (saveLogUiCallback) {
                            saveLogUiCallback(params);
                        }
                        return Promise.resolve({ success: true });
                    }
                });

                isSdkInitialized = true;
                logEvent('SYSTEM', 'Status', 'Five9 CRM SDK successfully initialized & callbacks registered!');
            } catch (err) {
                logEvent('SYSTEM', 'Error', 'Failed to initialize window.Five9.CrmSdk: ' + err.message);
            }
        } else {
            logEvent('SYSTEM', 'Warning', 'Five9.CrmSdk JS library not detected on window. Using direct iframe bridge.');
        }

        // Listen for direct postMessages from iframe (for Mock ADT simulator fallback/direct events)
        window.addEventListener('message', handleDirectIframeEvents);
    }

    // Handle direct events from the Mock ADT iframe (screenPop, saveLog, callConnected, callEnded)
    function handleDirectIframeEvents(event) {
        const data = event.data;
        if (!data || data.source !== 'Five9ADT') return;

        logEvent('INBOUND', `ADT Event: ${data.event}`, data.payload || {});

        if (data.event === 'screenPop' && screenPopUiCallback) {
            screenPopUiCallback(data.payload);
        } else if (data.event === 'saveLog' && saveLogUiCallback) {
            saveLogUiCallback(data.payload);
        }
    }

    // Click-to-Dial trigger method called when user clicks Dial button outside iframe
    function clickToDial(phoneNumber, campaignName) {
        const campaign = campaignName || 'mo_amex_ob_manual';
        // Clean phone number: remove spaces, hyphens, brackets
        const cleanNumber = String(phoneNumber).trim().replace(/[\s\-\(\)]/g, '');
        logEvent('OUTBOUND', 'click2dial', { phoneNumber: cleanNumber, campaignName: campaign });

        const click2DialData = {
            clickToDialNumber: cleanNumber,
            preselectedCampaignName: campaign,
            campaignName: campaign,
            campaign: campaign,
            useCurrentlySelectedCampaign: true,
            defaultCampaign: true,
            crmObject: {
                id: '101',
                label: 'Contact',
                name: 'John Customer',
                isWho: true,
                isWhat: false
            }
        };

        const payload = {
            click2DialData: click2DialData,
            clickToDialData: click2DialData
        };

        let sdkSuccess = false;

        // Try standard Five9 InteractionApi click2dial
        if (interactionApi && typeof interactionApi.click2dial === 'function') {
            try {
                const res = interactionApi.click2dial(payload);

                if (res && typeof res.then === 'function') {
                    res.then(function (result) {
                        logEvent('INBOUND', 'click2dial:Response', result || { status: 'success' });
                    }).catch(function (err) {
                        logEvent('SYSTEM', 'click2dial:Error', err);
                    });
                } else {
                    logEvent('OUTBOUND', 'click2dial:Dispatched', payload);
                }
                sdkSuccess = true;
            } catch (e) {
                logEvent('SYSTEM', 'click2dial:Exception', e.message);
            }
        }

        // Also postMessage to the iframe element directly (ensures Mock ADT handles it immediately)
        const iframeEl = document.getElementById('five9-adt-iframe');
        if (iframeEl && iframeEl.contentWindow) {
            iframeEl.contentWindow.postMessage({
                action: 'click2dial',
                type: 'click2dial',
                click2DialData: click2DialData,
                clickToDialData: click2DialData
            }, '*');
            logEvent('OUTBOUND', 'postMessage(click2dial)', 'Sent directly to iframe window');
        }

        return sdkSuccess;
    }

    return {
        init: initSdk,
        clickToDial: clickToDial,
        setLogInspector: setLogInspector,
        setScreenPopHandler: setScreenPopHandler,
        setSaveLogHandler: setSaveLogHandler
    };
})();
