# Vehkit — Mobile (Expo / React Native)

Not yet initialized. Bootstrap when ready:

```bash
cd apps
npx create-expo-app@latest mobile --template blank-typescript
cd mobile
npx expo install @supabase/supabase-js @supabase/ssr expo-secure-store @react-native-async-storage/async-storage
```

Then:

1. Create `apps/mobile/lib/supabase.ts` mirroring the web client, using `expo-secure-store` for session persistence
2. Add `@vehkit/types` and `@vehkit/ui` as workspace dependencies in `package.json`
3. Wire Tamagui or NativeWind, consuming tokens from `@vehkit/ui/tokens`
4. Configure EAS Build for iOS + Android: `npx eas-cli build:configure`
