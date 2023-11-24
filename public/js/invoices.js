const $ = jQuery;

const paginationData = {
  skip: 0, limit: 5, page: 1, pageSize: 5,
};

const makeRefund = async (intentId, amount) => {
  try {
    await axios({
      method: 'PUT',
      url: `/invoices/refund/${intentId}`,
      data: { amount },
    });
    getInvoices();
    $('.cfm-refund').toggleClass('hidden');
    $('.close-modal').click();
  } catch (err) {
    const message = err.response?.data?.message ?? 'Server error';

    const alertBlock = $('.invoices-table .alert');
    alertBlock.text(message);
    alertBlock.toggleClass('hidden');
    setTimeout(() => { alertBlock.toggleClass('hidden'); }, 3000);
  }
};

const confirmRefund = async () => {
  const amount = $('.refund-amount-input').val();
  const paymentEl = $('payment');
  const intentId = paymentEl.attr('invoice');
  const paymentAmount = +paymentEl.attr('amount');
  const paymentRefunded = +paymentEl.attr('refunded');
  const available = Math.max(0, paymentAmount, paymentRefunded);

  const me = $('.cfm-refund');

  if ((amount === '' || +amount >= available) && !me.attr('force')) {
    $('.refund-modal-message').removeClass('hidden');
    me.attr('force', true).text('Confirmer pleine');
    $('.close-refund-modal').on('click', () => {
      me.removeAttr('force').text('Confirmer');
      $('.refund-modal-message').addClass('hidden');
    });
    return;
  }

  await makeRefund(intentId, amount);
};

const paginationCB = (data, pagination) => {
  if (paginationData.page === pagination.pageNumber && pagination.pageSize === paginationData.pageSize) return;
  paginationData.limit = pagination.pageSize;
  paginationData.skip = (pagination.pageNumber * pagination.pageSize) - pagination.pageSize;
  paginationData.page = pagination.pageNumber;
  paginationData.pageSize = pagination.pageSize;

  getInvoices();
};

const renderStatusString = (status) => {
  let str = '';
  switch (status) {
    case 'SUCCEEDED': str = 'Réussi';
      break;
    case 'PENDING': str = 'En attente';
      break;
    case 'PENDING_REFUND': str = 'En attente';
      break;
    case 'REFUNDED': str = 'Remboursé';
      break;
    default: str = '';
  }

  return str;
};

const getInvoices = async () => {
  try {
    const axiosData = {
      url: '/invoices/list',
      withCredentials: true,
      method: 'GET',
      params: paginationData,
    };
    const { data } = await axios(axiosData);
    const invoiceList = data.invoices;

    const tableBody = $('.invoice-table-body');
    tableBody.empty();

    const tableItems = invoiceList.map((invoice) => {
      const tr = $('<tr></tr>');
      const refundButton = $(`
          <button type="button" class="refunds-button" data-toggle="modal" data-target="#exampleModal">
            <i  class="fa-solid fa-arrow-rotate-left"></i>
          </button>`);
      const maxRefund = Math.max(0, (invoice.amountCents - invoice.refundedCents) / 100);
      refundButton.on('click', () => {
        const paymentEl = $('payment');
        paymentEl.attr('invoice', invoice._id);
        paymentEl.attr('amount', invoice.amountCents);
        paymentEl.attr('refunded', invoice.refundedCents);
        const refundValueInput = $('.refund-amount-input');
        refundValueInput.val('');
        refundValueInput.on('input', () => {
          $('.cfm-refund')
            .removeAttr(('force'))
            .text('Confirmer');

          $('.refund-modal-message').addClass('hidden');
        });

        const maxRefundAmount = Math.max(0, (invoice.amountCents - invoice.refundedCents) / 100);
        $('.refund-amount-input-label').html(`Remboursement maximum disponible: ${maxRefundAmount} &euro;`);
      });

      let createdAt = '';
      if (invoice.createdAt) {
        createdAt = moment(invoice.createdAt).format('MM/DD/YYYY HH:mm');
      }

      tr.append(
        $(`<th>${renderStatusString(invoice.status)}</th>`),
        $(`<th>${invoice.amountCents / 100}</th>`),
        $(`<th>${invoice.refundedCents / 100}</th>`),
        $(`<th>${createdAt}</th>`),
        $('<th></th>').append((maxRefund && invoice.status === 'SUCCEEDED') ? refundButton : null),
      );
      return tr;
    });
    tableBody.append(...tableItems);
    if ($('.pagination').is(':empty')) {
      $('.pagination').pagination({
        dataSource: Array.from(Array(data.count).keys()),
        pageSize: paginationData.limit,
        showSizeChanger: true,
        callback: paginationCB,
      });
    }
  } catch (err) {

  }
};

getInvoices();
