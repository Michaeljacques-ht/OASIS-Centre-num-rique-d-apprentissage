const assert = require('node:assert/strict');
const S = require('../modules/surlignages');
const ok = S.valider({ type: 'surlignage', couleur: 'vert', texte: '  La   réforme Bernard ', unite: 'page', page: 4, debut: 10, fin: 30, commentaire: ' à revoir ' });
assert.deepEqual([ok.couleur, ok.texte, ok.page, ok.commentaire, ok.type], ['vert', 'La réforme Bernard', 4, 'à revoir', 'surlignage']);
assert.equal(S.valider({ couleur: 'violet', texte: 'ab', unite: 'chapitre', page: 1, debut: 0, fin: 2 }).couleur, 'jaune', 'couleur inconnue → jaune');
for (const mauvais of [{ unite: 'ligne' }, { texte: 'a' }, { debut: 5, fin: 5 }, { debut: 0, fin: 9000 }, { page: 0 }, { texte: 'x'.repeat(2001) }])
  assert.throws(() => S.valider({ texte: 'passage', unite: 'page', page: 1, debut: 0, fin: 7, ...mauvais }));
assert.deepEqual(S.modification(ok, { couleur: 'rose', commentaire: 'note' }), { couleur: 'rose', commentaire: 'note' });
assert.throws(() => S.modification(ok, { couleur: 'noir' }));
assert.throws(() => S.modification(ok, {}));
assert.deepEqual(S.modification({ type: 'note' }, { texte: ' idée ' }), { texte: 'idée' });
console.log('Surlignages : couleurs, positions, limites et modifications vérifiés.');
