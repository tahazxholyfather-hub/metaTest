const getThemeColors = () => {
    const html = document.documentElement;

    const isDark =
        html.classList.contains('dark') ||
        html.getAttribute('data-theme') === 'dark';

    return {
        iconColor: isDark ? '#8B5CF6' : '#1C4070',
        iconBg: isDark
            ? 'rgba(139,92,246,0.15)'
            : 'rgba(28,64,112,0.15)',
    };
};

const getTourSteps = (): TourStepDef[] => {
    const { iconColor, iconBg } = getThemeColors();

    return [
        {
            selector: '.nav-home',
            icon: Home,
            iconColor,
            iconBg,
            badge: 'خانه',
            title: 'صفحه خانه',
            description: 'نمای کلی از عملکرد، آمار، میان‌برها و وضعیت پیشرفتت را اینجا می‌بینی.',
            tip: 'برای شروع هر روز، اول یک نگاه به خانه بنداز.'
        },
        {
            selector: '.nav-practice',
            icon: BookOpen,
            iconColor,
            iconBg,
            badge: 'تمرین',
            title: 'بخش تمرین',
            description: 'از این قسمت می‌تونی تمرین‌های آموزشی را شروع کنی و مهارتت را در مباحث مختلف بالا ببری.',
            tip: 'برای یادگیری بهتر، تمرین روزانه کوتاه ولی مداوم انجام بده.'
        },
        {
            selector: '.nav-tests',
            icon: ClipboardCheck,
            iconColor,
            iconBg,
            badge: 'آزمون',
            title: 'دنیای آزمون',
            description: 'اینجا می‌تونی در آزمون‌ها شرکت کنی، خودت را ارزیابی کنی و میزان آمادگی‌ات را بسنجی.',
            tip: 'بعد از چند جلسه تمرین، حتماً یک آزمون بده تا پیشرفتت را دقیق‌تر ببینی.'
        },
        {
            selector: '.nav-profile',
            icon: User,
            iconColor,
            iconBg,
            badge: 'پروفایل',
            title: 'پروفایل شما',
            description: 'اطلاعات حساب، تنظیمات، دستاوردها و جزئیات فعالیتت را از این بخش مدیریت کن.',
            tip: 'پروفایلت را کامل کن تا تجربه شخصی‌سازی‌شده‌تری داشته باشی.'
        },
        {
            selector: '.tour-stats',
            icon: Trophy,
            iconColor,
            iconBg,
            badge: 'آمار',
            title: 'خلاصه عملکرد شما',
            description: 'امتیاز کل، دقت پاسخ‌گویی، رتبه لیگ و زمان تمرین — همه یک‌جا.',
            tip: 'هر روز تمرین کن تا رتبه‌ات بالا بره!'
        },
        {
            selector: '.tour-shortcuts',
            icon: Rocket,
            iconColor,
            iconBg,
            badge: 'میان‌بر',
            title: 'دسترسی سریع',
            description: 'یادداشت‌ها، علاقه‌مندی‌ها، جعبه مرور و گزارش‌ها فقط یک کلیک فاصله دارن.',
            tip: 'از «جعبه مرور» برای مرور هوشمند استفاده کن.'
        },
        {
            selector: '.tour-activity',
            icon: TrendingUp,
            iconColor,
            iconBg,
            badge: 'فعالیت',
            title: 'نمودار پیشرفت',
            description: 'ببین کدام روزها بیشتر تمرین کردی و روند رشدت رو دنبال کن.',
            tip: 'فیلتر «سال» نمای کلی پیشرفتت رو نشون می‌ده.'
        },
        {
            selector: '.tour-streak',
            icon: Flame,
            iconColor,
            iconBg,
            badge: 'رکورد',
            title: 'روزهای متوالی',
            description: 'هر روز که تمرین کنی این عدد بالاتر می‌ره. رکوردت رو حفظ کن!',
            tip: 'حتی ۵ دقیقه تمرین هم streak رو زنده نگه می‌داره.'
        },
        {
            selector: '.tour-mastery',
            icon: Target,
            iconColor,
            iconBg,
            badge: 'مهارت',
            title: 'نقشه تسلط',
            description: 'نقاط قوت و ضعف درسی‌ات رو با نمودار رادار مشاهده کن.',
            tip: 'مباحثی که رنگشون کم‌رنگ‌تره نیاز به تمرین بیشتری دارن.'
        },
        {
            selector: '.tour-tasks',
            icon: Shield,
            iconColor,
            iconBg,
            badge: 'ماموریت',
            title: 'چالش‌های روزانه',
            description: 'ماموریت‌های دائمی و ویژه رو انجام بده و XP بگیر.',
            tip: 'ماموریت‌های ویژه زودتر منقضی می‌شن — عجله کن!'
        },
        {
            selector: '.tour-invites',
            icon: Users,
            iconColor,
            iconBg,
            badge: 'دعوت',
            title: 'دوستانت رو بیار',
            description: 'لینک دعوتت رو به اشتراک بذار و با ثبت‌نام هر نفر امتیاز بگیر.',
            tip: 'هر دعوت موفق = ۵۰۰ XP رایگان!'
        }
    ];
};
