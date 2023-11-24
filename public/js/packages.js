const $ = jQuery;

const packageElement = $('package');
const amountInput = $('.edit-package-amount');
const percentInput = $('.edit-package-percent');
const addAmountInput = $('.add-package-amount');
const addPercentInput = $('.add-package-percent');

const tableBody = $('#packages-row-body');

const onError = (alrt, err) => {
  console.log(alrt);
  alrt.html(err.response?.data?.message ?? err.message ?? 'Internal server error');
  alrt.removeClass('hidden');
};

const getPackagesList = () => axios({
  headers: { Authorization: localStorage.getItem('authorization') },
  method: 'GET',
  url: '/packages/list',
});

// eslint-disable-next-line no-undef
const updatePackage = (data) => axios({
  headers: { Authorization: localStorage.getItem('authorization') },
  method: 'PUT',
  url: '/packages',
  data,
});

// eslint-disable-next-line no-undef
const createPackage = (data) => axios({
  headers: { Authorization: localStorage.getItem('authorization') },
  method: 'POST',
  url: '/packages',
  data,
});

// eslint-disable-next-line no-undef
const deletePackage = (id) => axios({
  headers: { Authorization: localStorage.getItem('authorization') },
  method: 'DELETE',
  url: `/packages/${id}`,
});

const onDeletePackageOpenModal = (id) => {
  $('.delete-pkg-error').addClass('hidden');
  $('#delete-package-title').html(`Delete package ${id} ?`);
  $('delete-package').attr('id', id);
};

const buildPackagesTable = async () => {
  $('.table-container').toggleClass('hidden');
  tableBody.html('');
  const { data } = await getPackagesList();

  tableBody.append(
    data.map((el) => {
      const tr = $('<tr></tr>');
      tr.append(`<th> ${el._id}</th><th> ${el.amountCents / 100}</th><th> ${el.percent}</th>`);
      const changePackageButton = $(`<button type="button" class="edit-package-button  table-button"
       data-toggle="modal" data-target="#edit-package-modal"><i class="fa-solid fa-pen"></i> </button>`);
      changePackageButton.on('click', onOpenPackageModal(el));

      const deletePackageButton = $(`<button type="button" class="delete-package-button table-button"
       data-toggle="modal" data-target="#delete-package-modal"><i class="fa-solid fa-trash"></i></button>`);
      deletePackageButton.on('click', onDeletePackageOpenModal(el._id));

      tr.append(
        $('<th></th>').append(changePackageButton),
        $('<th></th>').append(deletePackageButton),
      );

      return tr;
    }),
  );
};

const confirmEditPackage = () => {
  const id = packageElement.attr('id');
  const amountCents = amountInput.val();
  const percent = percentInput.val();

  const data = { id, amountCents, percent };

  return updatePackage(data).then(() => {
    $('.close-refund-modal').click();

    tableBody.html('');
    buildPackagesTable();
  }).catch((err) => {
    onError($('edit-pkg-error'), err);
  });
};

const onOpenPackageModal = (packageData) => () => {
  packageElement.attr('id', packageData._id);
  amountInput.val(packageData.amountCents);
  percentInput.val(packageData.percent);
  $('edit-pkg-error').addClass('hidden');
};

const onConfirmDeletePackage = async () => {
  const id = $('delete-package').attr('id');
  deletePackage(id)
    .then(() => {
      $('.close-delete-modal').click();
      buildPackagesTable();
    })
    .catch((err) => {
      onError($('.delete-pkg-error'), err);
    });
};

const confirmAddPackage = () => {
  const amountCents = addAmountInput.val();
  const percent = addPercentInput.val();

  const data = { amountCents, percent };

  return createPackage(data).then(() => {
    $('.add-package-modal-button').click();
    addAmountInput.val('');
    addPercentInput.val('');
    buildPackagesTable();
  }).catch((err) => {
    onError($('.add-pkg-error'), err);
  });
};
