const search = document.querySelector('#post-search');

if (search) {
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const groups = [...document.querySelectorAll('.post-group')];
  const emptyState = document.querySelector('.empty-state');
  let selected = 'all';

  const filterPosts = () => {
    const query = search.value.trim().toLowerCase();
    let visible = 0;

    for (const group of groups) {
      let groupVisible = 0;
      for (const post of group.querySelectorAll('.post-row')) {
        const matches = (selected === 'all' || post.dataset.series === selected) && post.dataset.search.includes(query);
        post.hidden = !matches;
        groupVisible += Number(matches);
      }
      group.hidden = groupVisible === 0;
      visible += groupVisible;
    }

    emptyState.hidden = visible > 0;
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.filter === selected));
  };

  search.addEventListener('input', filterPosts);
  for (const button of buttons) {
    button.addEventListener('click', () => {
      selected = button.dataset.filter;
      filterPosts();
    });
  }
  document.querySelectorAll('.site-header nav a').forEach(link => {
    link.addEventListener('click', () => {
      selected = 'all';
      search.value = '';
      filterPosts();
    });
  });
}