const registerContainer = $('.register-admin-container');
const loginContainer = $('.login-admin-container');

const authorizedContainer = $('.authorized-content');
const unauthorizedContainer = $('.unauthorized-content');

const ensureAuth = (token) => {
  $('.header_inner_right').addClass('hidden');
  if (token) {
    localStorage.setItem('authorization', `Bearer ${token}`);
  }
  const currentAuthentication = localStorage.getItem('authorization');

  if (currentAuthentication) {
    authorizedContainer.removeClass('hidden');
    unauthorizedContainer.addClass('hidden');

    buildPackagesTable();
  } else {
    authorizedContainer.addClass('hidden');
    unauthorizedContainer.removeClass('hidden');
  }
};

// eslint-disable-next-line no-unused-vars
const logoutAdmin = () => {
  localStorage.removeItem('authorization');
  ensureAuth();
  openLoginContent();
};

// eslint-disable-next-line no-unused-vars
const openCreateAdminContent = () => {
  registerContainer.removeClass('hidden');
  loginContainer.addClass('hidden');
};

// eslint-disable-next-line no-unused-vars
const openLoginContent = () => {
  registerContainer.addClass('hidden');
  loginContainer.removeClass('hidden');
};

const onCreateAdminError = (err) => {
  const alert = $('#r-admin-error');
  alert.html(err.response?.data?.message ?? err.message ?? 'Internal server error');
  alert.removeClass('hidden');
  setTimeout(() => {
    alert.addClass('hidden');
  }, 3000);
};

const onCreateAdminSuccess = ({ data }) => {
  const alert = $('#r-admin-success');
  alert.removeClass('hidden');
  alert.html(`Admin ${data.email} was successfully  created`);
  setTimeout(() => {
    alert.addClass('hidden');
    $('#r-email-admin').val('');
    $('#r-password-admin').val('');
    $('#r-secret-admin').val('');
    $('#r-write-access')[0].checked = false;
    $('#r-update-access')[0].checked = false;
    $('#r-delete-access')[0].checked = false;

    ensureAuth(data.token);
  }, 500);
};

const onLoginError = (err) => {
  const alert = $('#l-admin-error');
  alert.html(err.response?.data?.message ?? err.message ?? 'Internal server error');
  alert.removeClass('hidden');
};
// eslint-disable-next-line no-undef
const registerAdmin = (data) => axios({ url: '/admin', method: 'POST', data })
  .then(onCreateAdminSuccess)
  .catch(onCreateAdminError);

// eslint-disable-next-line no-undef
const loginAdmin = (data) => axios({ url: '/admin/login', method: 'POST', data })
  .then((resp) => ensureAuth(resp.data))
  .catch(onLoginError);

// eslint-disable-next-line no-unused-vars
const onSubmitRegisterAdmin = () => {
  const email = $('#r-email-admin').val();
  const token = $('#r-secret-admin').val();
  const writeAccess = $('#r-write-access')[0].checked;
  const updateAccess = $('#r-update-access')[0].checked;
  const deleteAccess = $('#r-delete-access')[0].checked;

  const permissions = ['R'];
  if (writeAccess) { permissions.push('W'); }
  if (updateAccess) { permissions.push('U'); }
  if (deleteAccess) { permissions.push('D'); }

  const data = { email, token, permissions };

  if (Object.values(data).includes('')) {
    console.log('error ');
    return null;
  }

  return registerAdmin(data);
};

// eslint-disable-next-line no-unused-vars
const onAdminLogin = () => {
  const email = $('#l-email-admin').val();
  const password = $('#l-password-admin').val();

  const data = { email, password };

  if (Object.values(data).includes('')) {
    console.log('error ');
    return null;
  }

  return loginAdmin(data);
};

const sendPassword = async () => {
  const email = $('#l-email-admin').val();

  try {
    await axios({
      url: '/admin/password',
      method: 'POST',
      data: { email },
    });

    $('.login-button').removeClass('hidden');
    $('.get-pwd').addClass('hidden');
    $('.pwd-inputs').removeClass('hidden');
  } catch (err) {
    const errBlock = $('#l-admin-error');
    onError(errBlock, err);
  }
};

ensureAuth();
