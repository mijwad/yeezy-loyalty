// Central Modals Orchestrator
import { store } from '../state/store.js';
import { renderAmountSpentModal, attachAmountSpentModalListeners } from './AmountSpentModal.js';
import { renderRefillModal, attachRefillModalListeners } from './RefillCreditsModal.js';
import { renderAutoRefillModal, attachAutoRefillModalListeners } from './AutoRefillModal.js';
import { renderBookDemoModal, attachBookDemoModalListeners } from './BookDemoModal.js';
import { renderCustomerDrawer, attachCustomerDrawerListeners } from './CustomerDrawerModal.js';
import { renderActivationSuccessModal, attachActivationSuccessModalListeners } from './ActivationSuccessModal.js';
import { renderPOSTerminalModal, attachPOSTerminalModalListeners } from './POSTerminalModal.js';
import { renderRegisterCustomerModal, attachRegisterCustomerModalListeners } from './RegisterCustomerModal.js';
import { renderPetpoojaIntegrationModal, attachPetpoojaIntegrationModalListeners } from './PetpoojaIntegrationModal.js';

export function renderActiveModal(state, uiState) {
  const { activeModal, amountSpentSlide, selectedCustomer } = uiState;
  if (!activeModal) return '';

  switch (activeModal) {
    case 'petpoojaIntegration':
      return renderPetpoojaIntegrationModal(state);
    case 'posTerminal':
      return renderPOSTerminalModal(state);
    case 'registerCustomer':
      return renderRegisterCustomerModal();
    case 'amountSpent':
      return renderAmountSpentModal(amountSpentSlide);
    case 'refill':
      return renderRefillModal();
    case 'autoRefill':
      return renderAutoRefillModal(state);
    case 'bookDemo':
      return renderBookDemoModal();
    case 'customerDrawer':
      return renderCustomerDrawer(selectedCustomer);
    case 'activationSuccess':
      return renderActivationSuccessModal(state.loyaltyProgram.title);
    default:
      return '';
  }
}

export function attachActiveModalListeners(uiState) {
  const { activeModal } = uiState;
  if (!activeModal) return;

  switch (activeModal) {
    case 'petpoojaIntegration':
      attachPetpoojaIntegrationModalListeners();
      break;
    case 'posTerminal':
      attachPOSTerminalModalListeners();
      break;
    case 'registerCustomer':
      attachRegisterCustomerModalListeners();
      break;
    case 'amountSpent':
      attachAmountSpentModalListeners();
      break;
    case 'refill':
      attachRefillModalListeners();
      break;
    case 'autoRefill':
      attachAutoRefillModalListeners();
      break;
    case 'bookDemo':
      attachBookDemoModalListeners();
      break;
    case 'customerDrawer':
      attachCustomerDrawerListeners();
      break;
    case 'activationSuccess':
      attachActivationSuccessModalListeners();
      break;
  }
}

