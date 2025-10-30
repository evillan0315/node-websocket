import { atom } from 'nanostores';

// Placeholder for projectRootDirectoryStore. In a full IDE, this would reflect the opened project.
export const projectRootDirectoryStore = atom<string>(sessionStorage.getItem('projectRoot') || '/');

projectRootDirectoryStore.listen((root) => {
  sessionStorage.setItem('projectRoot', root);
});
