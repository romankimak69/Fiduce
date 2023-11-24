const fileListBody = $('.file-list-modal-body');
const getFileList = (userId) => axios({
  headers: { Authorization: localStorage.getItem('authorization') },
  method: 'GET',
  url: `/admin/files-list/${userId}`,
});

const getFile = (file) => axios({
  headers: { Authorization: localStorage.getItem('authorization') },
  method: 'GET',
  responseType: 'blob',
  url: `/admin/user-file/${file._id}`,
})
  .then((response) => {
    const contentType = response.headers.get('content-type');
    const url = window.URL.createObjectURL(new Blob([response.data], { type: contentType }));

    const tab = window.open();
    tab.location.href = url;
  });

const onFileListPopupOpen = (user) => async () => {
  fileListBody.html('');
  const { data } = await getFileList(user._id);
  data.forEach((file) => {
    const downloadButton = $('<button class="download-file-button"></button>');

    const div = $(
      `<li class="file-item">
          <span>${file.filename}</span>
       </li>`,
    );
    div.on('click', async () => getFile(file));
    div.append(downloadButton);

    fileListBody.append(div);
  });

  if (!data.length) {
    fileListBody.html('User has  no files ');
  }
};
