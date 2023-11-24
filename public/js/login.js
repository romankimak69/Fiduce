const usernameGetPasswordInput = $('.get-pwd-username');
const loginNameInput = $('.username-input');

const loginForm = $('#login-form');

const redirect = localStorage.getItem('redirectAfterLogin');
if (redirect?.length) {
  const loginFormUrl = loginForm.attr('action');
  loginForm.attr('action', `${loginFormUrl}?redirectTo=${JSON.parse(redirect)}`);
}

const onError = (err) => {
  const errDiv = $('.password-error');
  errDiv
    .text(err?.response?.data?.message ?? err?.response?.message ?? err?.message ?? 'Internal Error')
    .removeClass('hidden');
};

const onSuccess = () => {
  loginNameInput.val(usernameGetPasswordInput.val());
  $('#login').removeClass('hidden');
  $('#get-password').addClass('hidden');
  $('.password-error').text('').addClass('hidden');
};

$('.getpassword-input').on('click', () => {
  const username = usernameGetPasswordInput.val();
  axios({ method: 'PATCH', url: '/users/password', data: { username } })
    .then(onSuccess)
    .catch(onError);
});
