rm -Rf /tmp/git-gh-pages-TMP && \
mkdir -p /tmp/git-gh-pages-TMP/css && \
mkdir -p /tmp/git-gh-pages-TMP/img && \
mkdir -p /tmp/git-gh-pages-TMP/js && \
cp -r css/*   /tmp/git-gh-pages-TMP/css/ && \
cp -r img/* /tmp/git-gh-pages-TMP/img/ && \
cp -r js/* /tmp/git-gh-pages-TMP/js/ && \
cp index.html /tmp/git-gh-pages-TMP/ && \
cp favicon.ico /tmp/git-gh-pages-TMP/ && \
git checkout gh-pages && \
cp -r /tmp/git-gh-pages-TMP/css ./ && \
cp -r /tmp/git-gh-pages-TMP/img ./ && \
cp -r /tmp/git-gh-pages-TMP/js ./ && \
cp /tmp/git-gh-pages-TMP/index.html ./ && \
cp /tmp/git-gh-pages-TMP/favicon.ico ./ && \
rm -R /tmp/git-gh-pages-TMP/ && \
git add . && \
git commit -m "Syncing gh-pages" && \
git push origin gh-pages && \
git checkout master
