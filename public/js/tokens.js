const reclaimErrorEl = $('.reclaim-error');
const reclaimAmountInput = $('.reclaim-funds-input');

const openReclaimModal = () => {
  reclaimAmountInput.val('');
  reclaimErrorEl.addClass('hidden');
};

const onReclaimError = (error) => {
  const errorMessage = error.response?.data?.message ?? error.message;
  reclaimErrorEl
    .removeClass('hidden')
    .html(typeof error === 'string' ? error : errorMessage ?? 'Internal server error');
};

const confirmReclaim = async () => {
  const amount = reclaimAmountInput.val();

  if (!Number.isInteger(+amount)) {
    return onReclaimError('Incorrect amount');
  }

  await axios({
    url: '/payments/reclaim-withdrawals',
    method: 'POST',
    data: { amount: amount * 100 },
  }).then(() => {
    $('.close-reclaim-withdrawals').click();
  }).catch(onReclaimError);
};
