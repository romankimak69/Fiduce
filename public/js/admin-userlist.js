const usersTableBody = $('#users-row-body');
const getPaidInput = $('.get-paid-amount');
const getPaidError = $('.get-paid-error');
const getPaidSection = $('get-paid');

const getUserList = () => axios({
  headers: { Authorization: localStorage.getItem('authorization') },
  method: 'GET',
  url: '/admin/user-list',
});

const withdrawUserBalance = (data) => axios({
  headers: { Authorization: localStorage.getItem('authorization') },
  method: 'POST',
  url: '/admin/users/reclaim-withdrawal',
  data,
});

const onWithdrawPopupOpen = (user, balance) => () => {
  $('.get-paid-header-user')
    .text(user.email);
  getPaidInput.val(balance);
  getPaidInput.attr('max', balance);
  getPaidSection.attr('user', user._id);
};

const confirmWithdraw = async () => {
  const value = +getPaidInput.val();
  const user = getPaidSection.attr('user');
  if (value > +getPaidInput.attr('max')) {
    getPaidError.removeClass('hidden');
    getPaidError.text('Invalid  amount');
  }

  const data = {
    user,
    amount: value * 100,
  };

  withdrawUserBalance(data)
    .then(() => {
      $('.close-get-paid-modal')
        .click();
      buildUsersList();
    })
    .catch((err) => onError(getPaidError, err));
};

const buildUsersList = async () => {
  $('.table-container')
    .toggleClass('hidden');
  usersTableBody.html('');

  const { data } = await getUserList();

  usersTableBody.append(
    data.map(({
      balance,
      user,
    }) => {
      const tr = $('<tr></tr>');
      tr.append(`<th> ${user.username}</th><th>${user.email}</th><th> ${balance}</th>`);

      const gainButton = $(
        `<button type="button" class="edit-package-button  table-button"
       data-toggle="modal" data-target="#get-paid-withdrawal-modal"><i class="fa-regular fa-credit-card"></i></button>`,
      );

      const seeFilesButton = $(
        `<button type="button" class="open-files"
       data-toggle="modal" data-target="#file-list-popup"><i class="fa-solid fa-file"></i></button>`,
      );

      seeFilesButton.on('click', onFileListPopupOpen(user));
      gainButton.on('click', onWithdrawPopupOpen(user, balance));

      tr.append(
        $('<th></th>')
          .append(seeFilesButton),
        $('<th></th>')
          .append(gainButton),
      );

      return tr;
    }),
  );
};
