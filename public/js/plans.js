function onPackageSelect() {
  const selectedSum = +$(this).attr('summ');
  localStorage.setItem('setAmount', JSON.stringify(selectedSum));
  localStorage.setItem('redirectAfterLogin', JSON.stringify('payments'));

  window.location.href = '/payments';
}

const reformatPackages = (packages) => packages.map((pack, index) => ({
  ...pack,
  upTo: (packages[index + 1]?.amountCents ?? 1) - 1,
}));

const buildPackages = async () => {
  try {
    const packs = await axios({ method: 'GET', url: '/packages/list' })
      .then(({ data }) => reformatPackages(data));

    console.log(packs);

    const packContainer = $('.packages-container');

    const packages = packs.map((pkg) => {
      const card = $('<div class="card col-xs-8 col-sm-7 col-md-5 col-xl-3"></div>');
      const body = $('<div class="card-body"></div>');
      const title = $(`<h5 class="card-title">${pkg.percent}% / an</h5>`);
      let lessString = `de ${pkg.amountCents / 100}`;
      if (pkg.amountCents === 50) {
        lessString = 'infêrieurs';
      }
      if (pkg.upTo === 0) {
        lessString = 'supêrieurs';
      }

      const text = $(
        `<p class="card-text"> Pour les dêpôts  ${lessString} à ${(pkg.upTo || pkg.amountCents) / 100}&euro;</p> `,
      );

      const button = $(` <button summ="${pkg.amountCents / 100}" id="submit-package" 
      class="btn btn-default btn-primary">
        <span id="button-text">Gains versês tous  les trimestres</span>
      </button>`);

      button.on('click', onPackageSelect);

      body.append(title).append(text).append(button);
      card.append(body);

      return card;
    });

    packContainer.append(packages);
  } catch (err) {

  }
};

buildPackages();
