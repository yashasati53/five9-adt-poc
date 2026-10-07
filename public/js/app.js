/**
 * Streamlined Portal Application Script
 * Triggers Click-to-Dial via Five9 CRM SDK from Outside the iFrame
 */

document.addEventListener('DOMContentLoaded', () => {
    const phoneNumberInput = document.getElementById('phoneNumberInput');
    const dialBtn = document.getElementById('dialBtn');
    const statusText = document.getElementById('statusText');

    // 1. Initialize Five9 CRM Manager & CRM SDK Callbacks
    Five9CrmManager.init();

    // 2. Click-to-Dial Button Event Handler
    dialBtn.addEventListener('click', () => {
        const rawNumber = phoneNumberInput.value.trim();
        if (!rawNumber) {
            alert('Please enter a phone number to dial.');
            phoneNumberInput.focus();
            return;
        }

        statusText.innerText = `Dialing ${rawNumber} (Campaign: mo_amex_ob_manual) via Five9 CRM SDK...`;

        // Call Five9 CRM SDK clickToDial method with campaign mo_amex_ob_manual
        const isSuccess = Five9CrmManager.clickToDial(rawNumber, 'mo_amex_ob_manual');

        if (isSuccess) {
            console.log(`[Portal] Click-to-Dial initiated for: ${rawNumber}`);
        }
    });

    // Handle ENTER key inside phone number input
    phoneNumberInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            dialBtn.click();
        }
    });
});
