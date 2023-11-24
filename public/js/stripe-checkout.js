// eslint-disable-next-line no-undef
const $ = jQuery;
// eslint-disable-next-line max-len
const secret = process.env.SK_TEST;

// FIXME: change on prod
// eslint-disable-next-line no-undef
const stripe = Stripe(secret, { locale: 'fr' });

// eslint-disable-next-line no-restricted-globals
const ORIGIN = location.origin;

let elements;
$('.input-amount').val(localStorage.getItem('setAmount'));
localStorage.removeItem('setAmount');
localStorage.removeItem('redirectAfterLogin');
$('.input-amount').on('keypress', (event) => {
  const regex = new RegExp('^[0-9]');
  const key = String.fromCharCode(!event.charCode ? event.which : event.charCode);
  if (!regex.test(key)) {
    event.preventDefault();
    return false;
  }
});
document.querySelector('#payment-form').addEventListener('submit', handleSubmit);

let cardNumber;
let cardExpiry;
let cardCvc;
let clientSecret;

const mountElements = (elems) => {
  cardNumber = elems.create('cardNumber', { showIcon: true });
  cardExpiry = elems.create('cardExpiry');
  cardCvc = elems.create('cardCvc');

  cardNumber.on('change', (event) => {
    if (!event.error && event.complete) {
      cardExpiry.focus();
    }
  });

  cardExpiry.on('change', (event) => {
    if (!event.error && event.complete) {
      cardCvc.focus();
    }
  });

  cardNumber.mount('#cardNumber');
  cardExpiry.mount('#cardExpiry');
  cardCvc.mount('#cardCvc');
};

function showMessage(messageText, isError) {
  // @ts-ignore
  const messageContainer = document.querySelector('#payment-message');
  const typeClass = isError ? 'error' : 'ok';
  if (!messageContainer) return;

  messageContainer.classList.remove('hidden');
  messageContainer.classList.add(typeClass);
  messageContainer.textContent = messageText;

  setTimeout(() => {
    messageContainer.classList.add('hidden');
    messageContainer.classList.remove(typeClass);
    // eslint-disable-next-line no-param-reassign
    messageText.textContent = '';
  }, 5000);
}

function setLoading(isLoading) {
  if (isLoading) {
    // @ts-ignore
    document.querySelector('#submit').disabled = true;
    // @ts-ignore
    document.querySelector('#spinner').classList.remove('hidden');
    // @ts-ignore
    document.querySelector('#button-text').classList.add('hidden');
  } else {
    // @ts-ignore
    document.querySelector('#submit').disabled = false;
    // @ts-ignore
    document.querySelector('#spinner').classList.add('hidden');
    // @ts-ignore
    document.querySelector('#button-text').classList.remove('hidden');
  }
}

async function initialize() {
  const amount = document.querySelector('.input-amount').value || 5;

  const response = await fetch(`${ORIGIN}/payments/create-payment-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  });

  const { clientSecret: sec, error } = await response.json();

  if (error) {
    showMessage(error, true);
    return;
  }

  clientSecret = sec;
  const appearance = { theme: 'none' };

  elements = stripe.elements({ appearance, clientSecret });
  mountElements(elements);
}

async function handleSubmit(e) {
  e.preventDefault();
  setLoading(true);

  const { error } = await stripe.confirmCardPayment(clientSecret, {
    setup_future_usage: 'off_session',
    payment_method: { card: cardNumber },
  });

  setLoading(false);

  if (!error) {
    showMessage('Paiement terminé');
    setTimeout(() => {
      window.location.href = `${ORIGIN}/invoices`;
    }, 1500);

    return;
  }

  if (error.type === 'card_error' || error.type === 'validation_error') {
    showMessage(error.message, true);
  } else {
    showMessage('An unexpected error occurred.', true);
  }
}

async function checkStatus() {
  clientSecret = new URLSearchParams(window.location.search).get('payment_intent_client_secret');

  if (!clientSecret) {
    return;
  }

  const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);

  switch (paymentIntent.status) {
    case 'succeeded':
      showMessage('Payment succeeded!');
      break;
    case 'processing':
      showMessage('Your payment is processing.');
      break;
    case 'requires_payment_method':
      showMessage('Your payment was not successful, please try again.');
      break;
    default:
      showMessage('Something went wrong.');
      break;
  }
}

function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

checkStatus();
initialize();
// eslint-disable-next-line no-unused-vars
const debounceInit = debounce(initialize);
