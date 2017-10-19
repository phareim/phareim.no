import { Phareim.NoPage } from './app.po';

describe('phareim.no App', () => {
  let page: Phareim.NoPage;

  beforeEach(() => {
    page = new Phareim.NoPage();
  });

  it('should display message saying app works', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('app works!');
  });
});
