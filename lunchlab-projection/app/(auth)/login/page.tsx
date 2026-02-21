import GoogleLoginButton from "./GoogleLoginButton";

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await props.searchParams;
  return (
    <div className="rounded-xl border bg-white p-8 shadow-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">점심구독 발주예측</h1>
        <p className="mt-2 text-sm text-gray-500">Google 계정으로 로그인하세요</p>
      </div>
      <GoogleLoginButton />
      {error && (
        <p className="mt-4 text-center text-sm text-red-500">
          {decodeURIComponent(error)}
        </p>
      )}
    </div>
  );
}
