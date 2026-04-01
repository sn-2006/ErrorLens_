import { getAuth, GithubAuthProvider, signInWithPopup } from "firebase/auth";

const auth = getAuth();
const provider = new GithubAuthProvider();

export async function loginWithGithub() {
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  return user; // return user instead of console.log
}