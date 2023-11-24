const { encrypt, decrypt } = require("../utils/encrypte-decrypte");

describe('Decrypte Encrypt', () => {
    it('Encrypte and decrypte a text must return the text back', () => {
      let text = "this is a test text";

      let hash = encrypt(text);
      console.log(hash);

      let outstr = decrypt(hash);
      console.log(outstr);

      expect(text).toEqual(outstr);
    })
});