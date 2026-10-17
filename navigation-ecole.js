/* Un lien explicite vers un livre ou le catalogue prime sur l’accueil établissement. */
(function(scope){
 function destination(role,recherche){const params=new URLSearchParams(recherche);const catalogue=params.get('vue')==='bibliotheque';const livre=!!params.get('livre');return {redirigerEcole:['admin_etablissement','bibliothecaire_ecole'].includes(role)&&!catalogue&&!livre,vue:catalogue?'bibliotheque':null};}
 scope.OasisNavigationEcole={destination};
})(typeof window==='undefined'?globalThis:window);
